/*
    This module create by: thanhchatvn@gmail.com
 */
odoo.define('pos_retail.load_models', function (require) {
    var models = require('point_of_sale.models');
    var time = require('web.time');
    var exports = {};
    var Backbone = window.Backbone;
    var bus = require('pos_retail.core_bus');
    var core = require('web.core');
    var _t = core._t;
    var session = require('web.session');
    var rpc = require('web.rpc');

    exports.pos_sync_pricelists = Backbone.Model.extend({
        initialize: function (pos) {
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notifications) {
            if (notifications && notifications[0] && notifications[0][1]) {
                for (var i = 0; i < notifications.length; i++) {
                    var channel = notifications[i][0][1];
                    if (channel == 'pos.sync.pricelists') {
                        var pricelists_model = _.filter(this.pos.models, function (model) {
                            return model.pricelist;
                        });
                        if (pricelists_model) {
                            var first_load = this.pos.load_server_data_by_model(pricelists_model[0]);
                            var self = this;
                            this.pricelists_model = pricelists_model;
                            return first_load.then(function () {
                                var second_load = self.pos.load_server_data_by_model(self.pricelists_model[1]);
                                return second_load.then(function () {
                                    var order = self.pos.get_order();
                                    var pricelist = self.pos._get_active_pricelist();
                                    if (order && pricelist) {
                                        order.set_pricelist(pricelist);
                                    }
                                    return self.pos.gui.screen_instances['products'].rerender_products_screen(self.pos.gui.chrome.widget["products_view_widget"].view_type);
                                })
                            })
                        }
                    }
                }
            }
        }
    });

    models.load_models([
        {
            model: 'stock.location',
            fields: ['name', 'location_id', 'company_id', 'usage', 'barcode'],
            domain: function (self) {
                return ['|', ['id', 'in', self.config.stock_location_ids], ['id', '=', self.config.stock_location_id[0]]];
            },
            loaded: function (self, stock_locations) {
                self.stock_locations = stock_locations;
                self.stock_location_by_id = {};
                self.stock_location_ids = [];
                for (var i = 0; i < stock_locations.length; i++) {
                    var stock_location = stock_locations[i];
                    self.stock_location_by_id[stock_location['id']] = stock_location;
                    if (stock_location.usage == 'internal') {
                        self.stock_location_ids.push(stock_location['id'])
                    }
                }
            },
        },
    ], {
        after: 'pos.config'
    });

    var extend_models = [
        {
            label: 'Multi Currency',
            model: 'res.currency',
            fields: [],
            domain: [['active', '=', true]],
            loaded: function (self, currencies) {
                self.currency_by_id = {};
                var i = 0;
                while (i < currencies.length) {
                    var currency = currencies[i];
                    currency['decimals'] = Math.ceil(Math.log(1.0 / currency.rounding) / Math.log(10));
                    self.currency_by_id[currencies[i].id] = currencies[i];
                    i++
                }
                self.currencies = currencies;
            }
        },
        {
            model: 'res.partner.group',
            fields: ['name', 'image', 'pricelist_applied', 'pricelist_id', 'height', 'width'],
            domain: function (self) {
                return []
            },
            loaded: function (self, membership_groups) {
                self.membership_groups = membership_groups;
                self.membership_group_by_id = {};
                for (var i = 0; i < membership_groups.length; i++) {
                    var membership_group = membership_groups[i];
                    self.membership_group_by_id[membership_group.id] = membership_group;
                }
            },
            retail: true,
        }, 
        {
            label: 'Units of Measure',
            model: 'uom.uom',
            fields: [],
            domain: [],
            loaded: function (self, uoms) {
                self.uom_by_id = {};
                for (var i = 0; i < uoms.length; i++) {
                    var uom = uoms[i];
                    self.uom_by_id[uom.id] = uom;
                }
            }
        },
        {
            label: 'Sellers',
            model: 'res.users',
            fields: ['display_name', 'name', 'pos_security_pin', 'barcode', 'pos_config_id', 'partner_id', 'image_1920'],
            context: {sudo: true},
            loaded: function (self, users) {
                self.user_by_id = {};
                self.user_by_pos_security_pin = {};
                self.user_by_barcode = {};
                self.default_seller = null;
                self.sellers = [];
                for (var i = 0; i < users.length; i++) {
                    var user = users[i];
                    if (user['pos_security_pin']) {
                        self.user_by_pos_security_pin[user['pos_security_pin']] = user;
                    }
                    if (user['barcode']) {
                        self.user_by_barcode[user['barcode']] = user;
                    }
                    self.user_by_id[user['id']] = user;
                    if (self.config.default_seller_id && self.config.default_seller_id[0] == user['id']) {
                        self.default_seller = user;
                    }
                    if (self.config.seller_ids.indexOf(user['id']) != -1) {
                        self.sellers.push(user)
                    }
                }
                self.user_by_id[user['id']];
                if (!self.default_seller) { // TODO: if have not POS Config / default_seller_id: we set default_seller is user of pos session
                    var pos_session_user_id = self.pos_session.user_id[0];
                    if (self.user_by_id[pos_session_user_id]) {
                        self.default_seller = self.user_by_id[pos_session_user_id]
                    }
                }
            }
        },
        {
            model: 'pos.tag',
            fields: ['name'],
            domain: [],
            loaded: function (self, tags) {
                self.tags = tags;
                self.tag_by_id = {};
                var i = 0;
                while (i < tags.length) {
                    self.tag_by_id[tags[i].id] = tags[i];
                    i++;
                }
            }
        }, {
            model: 'pos.note',
            fields: ['name'],
            loaded: function (self, notes) {
                self.notes = notes;
                self.note_by_id = {};
                var i = 0;
                while (i < notes.length) {
                    self.note_by_id[notes[i].id] = notes[i];
                    i++;
                }
            }
        }, {
            model: 'pos.combo.item',
            fields: ['product_id', 'product_combo_id', 'default', 'quantity', 'uom_id', 'tracking', 'required', 'price_extra'],
            domain: [],
            loaded: function (self, combo_items) {
                self.combo_items = combo_items;
                self.combo_item_by_id = {};
                for (var i = 0; i < combo_items.length; i++) {
                    self.combo_item_by_id[combo_items[i].id] = combo_items[i];
                }
            }
        },
        {
            model: 'stock.production.lot',
            fields: ['name', 'ref', 'product_id', 'product_uom_id', 'create_date', 'product_qty', 'barcode', 'replace_product_public_price', 'public_price'],
            lot: true,
            domain: function (self) {
                return [
                    '|', ['life_date', '>=', time.date_to_str(new Date()) + " " + time.time_to_str(new Date())], ['life_date', '=', null]
                ]
            },
            loaded: function (self, lots) {
                self.lots = lots;
                self.lot_by_name = {};
                self.lot_by_barcode = {};
                self.lot_by_id = {};
                self.lot_by_product_id = {};
                for (var i = 0; i < self.lots.length; i++) {
                    var lot = self.lots[i];
                    self.lot_by_name[lot['name']] = lot;
                    self.lot_by_id[lot['id']] = lot;
                    if (lot['barcode']) {
                        if (self.lot_by_barcode[lot['barcode']]) {
                            self.lot_by_barcode[lot['barcode']].push(lot)
                        } else {
                            self.lot_by_barcode[lot['barcode']] = [lot]
                        }
                    }
                    if (!self.lot_by_product_id[lot.product_id[0]]) {
                        self.lot_by_product_id[lot.product_id[0]] = [lot];
                    } else {
                        self.lot_by_product_id[lot.product_id[0]].push(lot);
                    }
                }
            }
        },
        {
            model: 'pos.config.image',
            condition: function (self) {
                return self.config.is_customer_screen;
            },
            fields: [],
            domain: function (self) {
                return [['config_id', '=', self.config.id]]
            },
            loaded: function (self, images) {
                self.images = images;
            }
        }, {
            model: 'pos.global.discount',
            fields: ['name', 'amount', 'product_id', 'reason', 'type'],
            loaded: function (self, discounts) {
                self.discounts = discounts;
                self.discount_by_id = {};
                var i = 0;
                while (i < discounts.length) {
                    self.discount_by_id[discounts[i].id] = discounts[i];
                    i++;
                }
            }
        }, {
            model: 'stock.picking.type',
            domain: [['code', '=', 'internal']],
            condition: function (self) {
                return self.config.internal_transfer;
            },
            loaded: function (self, stock_picking_types) {
                for (var i = 0; i < stock_picking_types.length; i++) {
                    if (stock_picking_types[i].warehouse_id) {
                        stock_picking_types[i]['name'] = stock_picking_types[i].warehouse_id[1] + ' / ' + stock_picking_types[i]['name']
                    }
                }
                self.stock_picking_types = stock_picking_types;
                self.stock_picking_type_by_id = {};
                for (var i = 0; i < stock_picking_types.length; i++) {
                    self.stock_picking_type_by_id[stock_picking_types[i]['id']] = stock_picking_types[i];
                }
                if (stock_picking_types.length == 0) {
                    console.warn('Stock picking Type is Null, could not active Internal Transfer')
                    self.config.internal_transfer = false
                }
            }
        },
        {
            model: 'product.uom.price',
            fields: [],
            domain: [],
            loaded: function (self, uoms_prices) {
                self.uom_price_by_uom_id = {};
                self.uoms_prices_by_product_tmpl_id = {};
                self.uoms_prices = uoms_prices;
                for (var i = 0; i < uoms_prices.length; i++) {
                    var item = uoms_prices[i];
                    if (item.product_tmpl_id) {
                        self.uom_price_by_uom_id[item.uom_id[0]] = item;
                        if (!self.uoms_prices_by_product_tmpl_id[item.product_tmpl_id[0]]) {
                            self.uoms_prices_by_product_tmpl_id[item.product_tmpl_id[0]] = [item]
                        } else {
                            self.uoms_prices_by_product_tmpl_id[item.product_tmpl_id[0]].push(item)
                        }
                    }
                }
            }
        }, {
            model: 'product.barcode',
            fields: ['product_tmpl_id', 'quantity', 'list_price', 'uom_id', 'barcode', 'product_id'],
            domain: [],
            loaded: function (self, barcodes) {
                self.barcodes = barcodes;
                self.barcodes_by_barcode = {};
                for (var i = 0; i < barcodes.length; i++) {
                    if (!barcodes[i]['product_id']) {
                        continue
                    }
                    if (!self.barcodes_by_barcode[barcodes[i]['barcode']]) {
                        self.barcodes_by_barcode[barcodes[i]['barcode']] = [barcodes[i]];
                    } else {
                        self.barcodes_by_barcode[barcodes[i]['barcode']].push(barcodes[i]);
                    }
                }
            }
        }, {
            model: 'product.variant',
            fields: ['product_tmpl_id', 'attribute_id', 'value_id', 'price_extra', 'product_id', 'quantity', 'uom_id'],
            domain: function (self) {
                return [['active', '=', true]];
            },
            loaded: function (self, variants) {
                self.variants = variants;
                self.variant_by_product_tmpl_id = {};
                self.variant_by_id = {};
                for (var i = 0; i < variants.length; i++) {
                    var variant = variants[i];
                    self.variant_by_id[variant.id] = variant;
                    if (!self.variant_by_product_tmpl_id[variant['product_tmpl_id'][0]]) {
                        self.variant_by_product_tmpl_id[variant['product_tmpl_id'][0]] = [variant]
                    } else {
                        self.variant_by_product_tmpl_id[variant['product_tmpl_id'][0]].push(variant)
                    }
                }
            }
        }, {
            model: 'product.attribute',
            fields: ['name', 'multi_choice'],
            domain: function (self) {
                return [];
            },
            loaded: function (self, attributes) {
                self.product_attributes = attributes;
                self.product_attribute_by_id = {};
                for (var i = 0; i < attributes.length; i++) {
                    var attribute = attributes[i];
                    self.product_attribute_by_id[attribute.id] = attribute;
                }
            }
        }, {
            model: 'pos.quickly.payment',
            fields: ['name', 'amount'],
            domain: [],
            context: {'pos': true},
            loaded: function (self, quickly_datas) {
                self.quickly_datas = quickly_datas;
                self.quickly_payment_by_id = {};
                for (var i = 0; i < quickly_datas.length; i++) {
                    self.quickly_payment_by_id[quickly_datas[i].id] = quickly_datas[i];
                }
            }
        },
        {
            model: 'account.payment.term',
            fields: ['name'],
            domain: [],
            context: {'pos': true},
            loaded: function (self, payments_term) {
                self.payments_term = payments_term;
            }
        }, {
            model: 'product.cross',
            fields: ['product_id', 'list_price', 'quantity', 'discount_type', 'discount', 'product_tmpl_id'],
            domain: [],
            loaded: function (self, cross_items) {
                self.cross_items = cross_items;
                self.cross_item_by_id = {};
                for (var i = 0; i < cross_items.length; i++) {
                    self.cross_item_by_id[cross_items[i]['id']] = cross_items[i];
                }
            }
        }, {
            model: 'medical.insurance',
            condition: function (self) {
                return self.config.medical_insurance;
            },
            fields: ['code', 'subscriber_id', 'patient_name', 'patient_number', 'rate', 'medical_number', 'employee', 'phone', 'product_id', 'insurance_company_id'],
            domain: function (self) {
                return []
            },
            loaded: function (self, insurances) {
                self.db.save_insurances(insurances);
            }
        }, {
            model: 'product.quantity.pack',
            fields: ['barcode', 'quantity', 'product_tmpl_id', 'public_price'],
            domain: function (self) {
                return []
            },
            loaded: function (self, quantities_pack) {
                self.quantities_pack = quantities_pack;
            }
        }, {
            model: 'pos.config',
            fields: [],
            domain: function (self) {
                return []
            },
            loaded: function (self, configs) {
                self.config_by_id = {};
                self.configs = configs;
                for (var i = 0; i < configs.length; i++) {
                    var config = configs[i];
                    self.config_by_id[config['id']] = config;
                    if (self.config['id'] == config['id'] && config.logo) {
                        self.config.logo_shop = 'data:image/png;base64,' + config.logo
                    }
                }
                if (self.config_id) {
                    var config = _.find(configs, function (config) {
                        return config['id'] == self.config_id
                    });
                    if (config) {
                        var user = self.user_by_id[config.user_id[0]]
                        if (user) {
                            self.set_cashier(user);
                        }
                    }
                }

            }
        }, {
            model: 'product.packaging',
            fields: [],
            domain: function (self) {
                return [['active', '=', true]]
            },
            loaded: function (self, packagings) {
                self.packaging_by_product_id = {};
                self.packaging_by_id = {};
                for (var i = 0; i < packagings.length; i++) {
                    var packaging = packagings[i];
                    self.packaging_by_id[packaging.id] = packaging;
                    if (!self.packaging_by_product_id[packaging.product_id[0]]) {
                        self.packaging_by_product_id[packaging.product_id[0]] = [packaging]
                    } else {
                        self.packaging_by_product_id[packaging.product_id[0]].push(packaging)
                    }
                }
            }
        }, {
            model: 'account.journal', // TODO: loading journal and linked pos_method_type to payment_methods variable of posmodel
            fields: ['name', 'code', 'pos_method_type', 'default_credit_account_id', 'default_debit_account_id', 'currency_id', 'decimal_rounding'],
            loaded: function (self, account_journals) {
                self.account_journals = account_journals;
                self.journal_by_id = {};
                for (var i = 0; i < account_journals.length; i++) {
                    var account_journal = account_journals[i];
                    self.journal_by_id[account_journal.id] = account_journal;
                    if (!account_journal.currency_id) {
                        account_journal.currency_id = self.config.currency_id;
                    }
                }
                if (self.payment_methods) {
                    for (var i = 0; i < self.payment_methods.length; i++) {
                        var payment_method = self.payment_methods[i];
                        if (payment_method.cash_journal_id) {
                            payment_method.journal = self.journal_by_id[payment_method.cash_journal_id[0]];
                            payment_method.pos_method_type = payment_method.journal['pos_method_type']
                        }
                    }
                }
            }
        }, {
            model: 'pos.voucher', // load vouchers
            fields: ['code', 'value', 'apply_type', 'method', 'use_date', 'number'],
            domain: [['state', '=', 'active']],
            context: {'pos': true},
            loaded: function (self, vouchers) {
                self.vouchers = vouchers;
                self.voucher_by_id = {};
                for (var x = 0; x < vouchers.length; x++) {
                    self.voucher_by_id[vouchers[x].id] = vouchers[x];
                }
            }
        },
        {
            model: 'pos.sale.extra', // load sale extra
            fields: ['product_id', 'quantity', 'list_price', 'product_tmpl_id'],
            loaded: function (self, sales_extra) {
                self.sales_extra = sales_extra;
                self.sale_extra_by_product_tmpl_id = {};
                self.sale_extra_by_id = {};
                for (var i = 0; i < sales_extra.length; i++) {
                    var sale_extra = sales_extra[i];
                    sale_extra['default_quantity'] = sale_extra['quantity'];
                    self.sale_extra_by_id[sale_extra['id']] = sale_extra;
                    if (!self.sale_extra_by_product_tmpl_id[sale_extra['product_tmpl_id'][0]]) {
                        self.sale_extra_by_product_tmpl_id[sale_extra['product_tmpl_id'][0]] = [sale_extra]
                    } else {
                        self.sale_extra_by_product_tmpl_id[sale_extra['product_tmpl_id'][0]].push(sale_extra)
                    }
                }
            }
        }, {
            model: 'product.price.quantity', // product price quantity
            fields: ['quantity', 'price_unit', 'product_tmpl_id'],
            loaded: function (self, records) {
                self.price_each_qty_by_product_tmpl_id = {};
                for (var i = 0; i < records.length; i++) {
                    var record = records[i];
                    var product_tmpl_id = record['product_tmpl_id'][0];
                    if (!self.price_each_qty_by_product_tmpl_id[product_tmpl_id]) {
                        self.price_each_qty_by_product_tmpl_id[product_tmpl_id] = [record];
                    } else {
                        self.price_each_qty_by_product_tmpl_id[product_tmpl_id].push(record);
                    }
                }
            }
        }, {
            model: 'stock.picking',
            fields: ['id', 'pos_order_id'],
            condition: function (self) {
                return self.config.pos_orders_management;
            },
            domain: [['is_picking_combo', '=', true], ['pos_order_id', '!=', null]],
            loaded: function (self, combo_pickings) {
                self.combo_pickings = combo_pickings;
                self.combo_picking_by_order_id = {};
                self.combo_picking_ids = [];
                for (var i = 0; i < combo_pickings.length; i++) {
                    var combo_picking = combo_pickings[i];
                    self.combo_picking_by_order_id[combo_picking.pos_order_id[0]] = combo_picking.id;
                    self.combo_picking_ids.push(combo_picking.id)
                }
            }
        }, {
            model: 'stock.move',
            fields: ['combo_item_id', 'picking_id', 'product_id', 'product_uom_qty'],
            condition: function (self) {
                return self.config.pos_orders_management;
            },
            domain: function (self) {
                return [['picking_id', 'in', self.combo_picking_ids]]
            },
            loaded: function (self, moves) {
                self.stock_moves_by_picking_id = {};
                for (var i = 0; i < moves.length; i++) {
                    var move = moves[i];
                    if (!self.stock_moves_by_picking_id[move.picking_id[0]]) {
                        self.stock_moves_by_picking_id[move.picking_id[0]] = [move]
                    } else {
                        self.stock_moves_by_picking_id[move.picking_id[0]].push(move)
                    }
                }
            }
        },
        {
            label: 'shop logo', // shop logo
            condition: function (self) {
                if (self.config.logo) {
                    return true
                } else {
                    return false;
                }
            },
            loaded: function (self) {
                self.company_logo = new Image();
                return new Promise(function (resolve, reject) {
                    self.company_logo.onload = function () {
                        var img = self.company_logo;
                        var ratio = 1;
                        var targetwidth = 300;
                        var maxheight = 150;
                        if (img.width !== targetwidth) {
                            ratio = targetwidth / img.width;
                        }
                        if (img.height * ratio > maxheight) {
                            ratio = maxheight / img.height;
                        }
                        var width = Math.floor(img.width * ratio);
                        var height = Math.floor(img.height * ratio);
                        var c = document.createElement('canvas');
                        c.width = width;
                        c.height = height;
                        var ctx = c.getContext('2d');
                        ctx.drawImage(self.company_logo, 0, 0, width, height);

                        self.company_logo_base64 = c.toDataURL();
                        resolve()
                    };
                    self.company_logo.onerror = function (error) {
                        reject()
                    };
                    self.company_logo.crossOrigin = "anonymous";
                    if (!self.is_mobile) {
                        self.company_logo.src = '/web/image' + '?model=pos.config&field=logo&id=' + self.config.id;
                    } else {
                        self.company_logo.src = '/web/binary/company_logo' + '?dbname=' + self.session.db + '&_' + Math.random();
                    }
                });
            },
        },
    ];

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        _get_domain_by_pos_order_period_return_days: function () {
            var today = new Date();
            var pos_order_period_return_days = this.config.pos_order_period_return_days;
            today.setDate(today.getDate() - pos_order_period_return_days);
            return ['create_date', '>=', time.date_to_str(today) + " " + time.time_to_str(today)];
        },
        load_server_data: function () {
            var self = this;
            if (!self.session.big_datas_turbo) {
                return _super_PosModel.load_server_data.apply(this, arguments).then(function () {
                    self.pos_sync_pricelists = new exports.pos_sync_pricelists(self);
                    self.pos_sync_pricelists.start();
                    return true;
                })
            } else {
                var progress = 0;
                var progress_step = 1.0 / self.models.length;
                var tmp = {}; // this is used to share a temporary state between models loaders
                this.cached = {};
                var loaded = new Promise(function (resolve, reject) {
                    function load_model(index) {
                        if (index >= self.models.length) {
                            resolve();
                        } else {
                            var model = self.models[index];
                            self.chrome.loading_message(_t('Loading') + ' ' + (model.label || model.model || ''), progress);

                            var cond = typeof model.condition === 'function' ? model.condition(self, tmp) : true;
                            if (!cond) {
                                load_model(index + 1);
                                return;
                            }

                            var fields = typeof model.fields === 'function' ? model.fields(self, tmp) : model.fields;
                            var domain = typeof model.domain === 'function' ? model.domain(self, tmp) : model.domain;
                            var context = typeof model.context === 'function' ? model.context(self, tmp) : model.context || {};
                            var ids = typeof model.ids === 'function' ? model.ids(self, tmp) : model.ids;
                            var order = typeof model.order === 'function' ? model.order(self, tmp) : model.order;
                            progress += progress_step;

                            if (model.model) {
                                var params = {
                                    model: model.model,
                                    context: _.extend(context, session.user_context || {}),
                                };

                                if (model.ids) {
                                    params.method = 'read';
                                    params.args = [ids, fields];
                                } else {
                                    params.method = 'search_read';
                                    params.domain = domain;
                                    params.fields = fields;
                                    params.orderBy = order;
                                }
                                if (self.json_datas) {
                                    var result = self.json_datas[index];
                                    model.loaded(self, result, tmp);
                                    load_model(index + 1);

                                } else {
                                    rpc.query(params).then(function (result) {
                                        self.cached[index] = result;
                                        console.log(index);
                                        try { // catching exceptions in model.loaded(...)
                                            Promise.resolve(model.loaded(self, result, tmp))
                                                .then(function () {
                                                        load_model(index + 1);
                                                    },
                                                    function (err) {
                                                        reject(err);
                                                    });
                                        } catch (err) {
                                            console.error(err.message, err.stack);
                                            reject(err);
                                        }
                                    }, function (err) {
                                        reject(err);
                                    });
                                }

                            } else if (model.loaded) {
                                try { // catching exceptions in model.loaded(...)
                                    Promise.resolve(model.loaded(self, tmp))
                                        .then(function () {
                                                load_model(index + 1);
                                            },
                                            function (err) {
                                                reject(err);
                                            });
                                } catch (err) {
                                    reject(err);
                                }
                            } else {
                                load_model(index + 1);
                            }
                        }
                    }

                    try {
                        return load_model(0);
                    } catch (err) {
                        return Promise.reject(err);
                    }
                });
                return loaded.then(function () {
                    self.pos_sync_pricelists = new exports.pos_sync_pricelists(self);
                    self.pos_sync_pricelists.start();
                    return true
                });
            }

        },
        initialize: function (session, attributes) {
            var pos_category_model = this.get_model('pos.category');
            if (pos_category_model) {
                pos_category_model.domain = function (self) {
                    if (self.config.limit_categories) {
                        return self.config.limit_categories && self.config.iface_available_categ_ids.length ? [['id', 'in', self.config.iface_available_categ_ids]] : [];
                    } else {
                        return []
                    }
                };
            }
            _super_PosModel.initialize.call(this, session, attributes);
            this.models = this.models.concat(extend_models);
        },
    });

    return exports;
});
