/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i'm not accepted
 */
odoo.define('pos_retail.model', function (require) {
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var round_pr = utils.round_precision;
    var _t = core._t;
    var rpc = require('pos.rpc');
    var session = require('web.session');
    var time = require('web.time');
    var Session = require('web.Session');

    models.load_models([
        {
            label: 'Your Odoo Server IP/Port and All POS Boxes',
            model: 'pos.iot',
            condition: function (self) {
                if (self.config.posbox_save_orders && self.config.posbox_save_orders_iot_ids.length) {
                    return true
                } else {
                    return false;
                }
            },
            fields: [],
            domain: function (self) {
                return [['id', 'in', self.config.posbox_save_orders_iot_ids]]
            },
            loaded: function (self, iot_boxes) {
                self.iot_boxes_save_orders_by_id = {};
                self.iot_boxes_save_orders = [];
                for (var i = 0; i < iot_boxes.length; i++) {
                    var iot_box = iot_boxes[i];
                    var iot_url = 'http://' + iot_box.proxy + ':' + iot_box.port;
                    self.iot_boxes_save_orders_by_id[iot_box['id']] = iot_box;
                    var iot_connection = new Session(void 0, iot_url, {
                        use_cors: true
                    });
                    self.iot_boxes_save_orders.push(iot_connection);
                    iot_connection.rpc('/pos/ping/server', {
                        ip: self.config.posbox_save_orders_server_ip,
                        port: self.config.posbox_save_orders_server_port
                    }, {shadow: true, timeout: 15000}).then(function (result) {
                    }).catch(function (error) {
                        var body = _t('Have one PosBox/Iot Setting On POS, wrong IP [port]');
                        alert(body);
                    })
                }
                self._bind_iot_boxes = false;
                var odoo_url = 'http://' + self.config.posbox_save_orders_server_ip + ':' + self.config.posbox_save_orders_server_port;
                var odoo_connection = new Session(void 0, odoo_url, {
                    use_cors: true
                });
                self._bind_iot();
                return odoo_connection.rpc('/pos/ping/server', {
                    ip: self.config.posbox_save_orders_server_ip,
                    port: self.config.posbox_save_orders_server_port,
                }, {shadow: true, timeout: 15000}).then(function (results) {
                    var value = JSON.parse(results);
                    return value
                }).catch(function (reason) {
                    var body = _t('Could not connect to Your Odoo with Ip address ' + self.config.posbox_save_orders_server_ip + ' with port ' + self.config.posbox_save_orders_server_port + '\n' +
                        'If Ip address correct, please checking your odoo-server.conf have add param: dbfilter=yourdatabase\n' +
                        'PLease checking Odoo Public Ip Address and Odoo Public Port at Tab PosBox/Iot Device of POS Setting\n'
                    );
                    alert(body);
                    throw reason;
                });
            }
        }
    ]);
    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        _bind_iot: function () { // TODO: get notifications update from another sessions the same bus id
            // TODO: timeout 30 seconds, auto checking status of all pos boxes
            var self = this;
            for (var i = 0; i < this.iot_boxes_save_orders.length; i++) {
                var iot = this.iot_boxes_save_orders[i];
                iot.rpc('/pos/ping/server', {
                    ip: this.config.posbox_save_orders_server_ip,
                    port: this.config.posbox_save_orders_server_port
                }, {shadow: true, timeout: 15000}).then(function (result) {
                    console.log('binding pos box success');

                }).catch(function (error) {
                    self.gui.show_popup('confirm', {
                        title: _t('1 Pos Box offline'),
                        body: _t('Please checking your pos boxes status.\n\n' +
                            'Have one pos box turnoff or your local network offline'),
                    });

                })
            }
            setTimeout(_.bind(this._bind_iot, this), 15000);
        },
        _flush_orders: function (orders, options) {
            // TODO: this is test case push 500 orders / current time
            var self = this;
            if (this.iot_boxes_save_orders) {
                if (orders.length) {
                    console.log('Send direct orders to posbox: ' + orders.length)
                    for (var i = 0; i < this.iot_boxes_save_orders.length; i++) {
                        this.iot_boxes_save_orders[i].rpc("/pos/save/orders", {
                            database: this.session.db,
                            orders: orders,
                            url: 'http://' + this.config.posbox_save_orders_server_ip + ':' + this.config.posbox_save_orders_server_port + '/pos/create_from_ui',
                            username: this.session.username,
                            server_version: this.session.server_version,

                        }, {shadow: true, timeout: 60000}).then(function (results) {
                            var order_ids = JSON.parse(results)['order_ids'];
                            for (var i = 0; i < order_ids.length; i++) {
                                self.db.remove_order(order_ids[i]);
                                self.set('failed', false);
                            }
                            return order_ids

                        }).catch(function (reason) {
                            console.error('Failed to send orders:', orders);
                            self.gui.show_sync_error_popup();
                            throw reason;
                        });
                    }
                }
                return Promise.resolve([]);
            } else {
                return _super_PosModel._flush_orders.apply(this, arguments)
            }
        },
        get_picking_source_location: function () {
            var stock_location_id = this.config.stock_location_id;
            var selected_order = this.get_order();
            if (selected_order && selected_order.location) {
                return selected_order.location;
            } else {
                return this.stock_location_by_id[stock_location_id[0]];
            }
        },
        get_all_source_locations: function () {
            if (this.stock_location_ids.length != 0) {
                return this.stock_location_ids.concat(this.config.stock_location_id[0])
            } else {
                return [this.config.stock_location_id[0]]
            }
        },
        generate_wrapped_name: function (name) {
            var MAX_LENGTH = 24; // 40 * line ratio of .6
            var wrapped = [];
            var current_line = "";

            while (name.length > 0) {
                var space_index = name.indexOf(" ");

                if (space_index === -1) {
                    space_index = name.length;
                }

                if (current_line.length + space_index > MAX_LENGTH) {
                    if (current_line.length) {
                        wrapped.push(current_line);
                    }
                    current_line = "";
                }

                current_line += name.slice(0, space_index + 1);
                name = name.slice(space_index + 1);
            }

            if (current_line.length) {
                wrapped.push(current_line);
            }

            return wrapped;
        },
        show_popup_clients: function (keep_screen) {
            var self = this;
            var quickly_search_client = this.config.quickly_search_client;
            if (quickly_search_client) {
                this.gui.show_screen(keep_screen);
                this.gui.show_popup('popup_selection_extend', {
                    title: 'Select Customer',
                    fields: ['name', 'email', 'phone', 'mobile'],
                    sub_datas: this.db.get_partners_sorted(5),
                    sub_search_string: this.db.partner_search_string,
                    sub_record_by_id: this.db.partner_by_id,
                    sub_template: 'clients_list',
                    sub_button: '<div class="btn btn-success pull-right go_clients_screen">Go Clients Screen</div>',
                    sub_button_action: function () {
                        self.gui.show_screen('clientlist')
                    },
                    body: 'Please select one client',
                    confirm: function (client_id) {
                        var client = self.db.get_partner_by_id(client_id);
                        if (client) {
                            self.gui.screen_instances["clientlist"]['new_client'] = client;
                            self.trigger('client:save_changes');
                        }
                    }
                })
            }
        },
        update_onhand_by_product: function (product) {
            var self = this;
            this.product_need_update = product;
            var stock_location_ids = this.get_all_source_locations();
            return this._get_stock_on_hand_by_location_ids([product.id], stock_location_ids).then(function (datas) {
                var list = [];
                for (var location_id in datas) {
                    var location = self.stock_location_by_id[location_id];
                    if (location) {
                        list.push({
                            'id': location['id'],
                            'location': location['name'],
                            'qty_available': datas[location_id][self.product_need_update.id]
                        })
                    }
                }
                if (list.length <= 0) {
                    self.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Product type not Stockable Product')
                    })
                } else {
                    return self.gui.show_popup('popup_selection_extend', {
                        title: _t('All Quantity Available of Product ' + self.product_need_update.name),
                        fields: ['location', 'qty_available'],
                        sub_datas: list,
                        sub_template: 'stocks_list',
                        confirm: function (location_id) {
                            self.location_id = location_id;
                            var location = self.stock_location_by_id[location_id];
                            setTimeout(function () {
                                return self.gui.show_popup('number', {
                                    'title': _t('Update Product Quantity of ' + self.product_need_update.name + ' to Location ' + location.name),
                                    'value': 0,
                                    'confirm': function (new_quantity) {
                                        var new_quantity = parseFloat(new_quantity);
                                        return rpc.query({
                                            model: 'stock.location',
                                            method: 'pos_update_stock_on_hand_by_location_id',
                                            args: [location.id, {
                                                product_id: self.product_need_update.id,
                                                product_tmpl_id: self.product_need_update.product_tmpl_id,
                                                new_quantity: new_quantity,
                                                location_id: location.id
                                            }],
                                            context: {}
                                        }).then(function (values) {
                                            self._do_update_quantity_onhand([self.product_need_update.id]);
                                            return self.gui.show_popup('confirm', {
                                                title: values['product'],
                                                body: values['location'] + ' have new on hand: ' + values['quantity'],
                                                color: 'success'
                                            })
                                        }, function (err) {
                                            return self.query_backend_fail(err);
                                        })
                                    }
                                })
                            }, 500)
                        }
                    })
                }
            });
        },
        show_purchased_histories: function (client) {
            var self = this;
            if (!client) {
                client = this.get_client();
            }
            if (!client) {
                this.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'We could not find purchased orders histories, please set client first'
                });
                this.gui.show_screen('clientlist')
            } else {
                var orders = this.db.get_pos_orders().filter(function (order) {
                    return order.partner_id && order.partner_id[0] == client['id']
                });
                if (orders.length) {
                    return this.gui.show_popup('popup_selection_extend', {
                        title: 'Purchased Histories of ' + client.name,
                        fields: ['name', 'ean13', 'date_order', 'pos_reference'],
                        sub_datas: orders,
                        sub_template: 'purchased_orders',
                        body: 'Please select one sale person',
                        confirm: function (order_id) {
                            var order = self.db.order_by_id[order_id];
                            self.gui.screen_instances['pos_orders_screen'].order_selected = order;
                            self.gui.show_screen('pos_orders_screen')
                        }
                    })
                } else {
                    this.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Your POS not active POS Order Management or Current Client have not any Purchased Orders'
                    })
                }
            }
        },
        _get_stock_on_hand_by_location_ids: function (product_ids = [], location_ids = []) {
            return new Promise(function (resolve, reject) {
                rpc.query({
                    model: 'stock.location',
                    method: 'get_stock_data_by_location_ids',
                    args: [[], product_ids, location_ids],
                    context: {}
                }, {shadow: true, timeout: 60000}).then(function (datas) {
                    resolve(datas)
                }, function (error) {
                    reject(error)
                })
            })
        },
        update_stock_on_hand_products: function () {
            var self = this;
            var location_ids = [];
            if (this.config.multi_location) {
                location_ids = location_ids.concat(this.config.stock_location_ids)
            }
            if (location_ids.indexOf(this.config.stock_location_id[0]) == -1) {
                location_ids.push(this.config.stock_location_id[0])
            }
            return this._get_stock_on_hand_by_location_ids([], location_ids).then(function (stock_datas_by_location_id) {
                self.stock_datas_by_location_id = stock_datas_by_location_id;
                var location = self.get_picking_source_location();
                console.log('selected stock location: ' + location.name);
                var stock_datas = self.stock_datas_by_location_id[location.id];
                if (!stock_datas) {
                    console.warn('Could not found stock datas of location: ' + location.name);
                    return;
                }
                self.db.stock_datas = stock_datas_by_location_id[location.id];
                var products = [];
                for (var product_id in stock_datas) {
                    var product = self.db.product_by_id[product_id];
                    if (product) {
                        products.push(product)
                    }
                }
                if (products.length && self.config.display_onhand) {
                    self.gui.screen_instances["products"].do_update_products_cache(products);
                    self.gui.screen_instances["products_operation"].refresh_screen();
                }
            })
        },
        _validate_by_manager: function (action_will_do_if_passing_security) {
            var self = this;
            var manager_validate = [];
            _.each(this.config.manager_ids, function (user_id) {
                var user = self.user_by_id[user_id];
                if (user) {
                    manager_validate.push({
                        label: user.name,
                        item: user
                    })
                }
            });
            if (manager_validate.length == 0) {
                this.gui.show_popup('confirm', {
                    title: 'Warning',
                    body: 'Your POS Setting / Tab Security not set Managers Approve',
                })
            }
            return this.gui.show_popup('selection', {
                title: 'Choice Manager Validate',
                body: 'Only Manager can approve this Discount, please ask him',
                list: manager_validate,
                confirm: function (manager_user) {
                    if (!manager_user.pos_security_pin) {
                        return self.gui.show_popup('confirm', {
                            title: 'Warning',
                            body: manager_user.name + ' have not set pos security pin before. Please set pos security pin first'
                        })
                    } else {
                        return self.gui.show_popup('ask_password', {
                            title: 'Pos Security Pin of Manager',
                            body: _t('This action need validate by you, please input your pos secuirty pin'),
                            confirm: function (password) {
                                if (manager_user['pos_security_pin'] != password) {
                                    self.gui.show_popup('dialog', {
                                        title: 'Error',
                                        body: 'Pos Security Pin of ' + manager_user.name + ' Incorrect !'
                                    });
                                    setTimeout(function () {
                                        self._validate_by_manager(action_will_do_if_passing_security);
                                    }, 1000)
                                } else {
                                    eval(action_will_do_if_passing_security);
                                }
                            }
                        });
                    }
                }
            })
        },
        _search_read_by_model_and_id: function (model, ids) {
            var object = this.get_model(model);
            return new Promise(function (resolve, reject) {
                rpc.query({
                    model: model,
                    method: 'search_read',
                    domain: [['id', 'in', ids]],
                    fields: object.fields
                }).then(function (datas) {
                    resolve(datas)
                }, function (error) {
                    reject(error)
                })
            })
        },
        _update_cart_qty_by_order: function (product_ids) {
            var order = this.get_order();
            if (!order) {
                return;
            }
            for (var i = 0; i < product_ids.length; i++) {
                var product_id = product_ids[i];
                var $qty = $('article[data-product-id="' + product_id + '"] .cart_qty');
                var product_quantity_by_product_id = order.product_quantity_by_product_id();
                var qty = product_quantity_by_product_id[product_id];
                if (qty) {
                    $qty.removeClass('oe_hidden');
                    $qty.html(qty);
                } else {
                    $qty.addClass('oe_hidden');
                }
            }
        },
        _get_active_pricelist: function () {
            var current_order = this.get_order();
            var default_pricelist = this.default_pricelist;
            if (current_order && current_order.pricelist) {
                var pricelist = _.find(this.pricelists, function (pricelist_check) {
                    return pricelist_check['id'] == current_order.pricelist['id']
                });
                return pricelist;
            } else {
                if (default_pricelist) {
                    var pricelist = _.find(this.pricelists, function (pricelist_check) {
                        return pricelist_check['id'] == default_pricelist['id']
                    });
                    return pricelist
                } else {
                    return null
                }
            }
        },
        _get_default_pricelist: function () {
            var current_pricelist = this.default_pricelist;
            return current_pricelist
        },
        get_model: function (_name) {
            var _index = this.models.map(function (e) {
                return e.model;
            }).indexOf(_name);
            if (_index > -1) {
                return this.models[_index];
            }
            return false;
        },
        initialize: function (session, attributes) {
            this.is_mobile = odoo.is_mobile;
            var account_tax_model = this.get_model('account.tax');
            account_tax_model.fields.push('type_tax_use');
            var wait_currency = this.get_model('res.currency');
            wait_currency.fields.push(
                'rate'
            );
            var account_fiscal_position_tax_model = this.get_model('account.fiscal.position.tax');
            var _super_account_fiscal_position_tax_model_loaded = account_fiscal_position_tax_model.loaded;
            account_fiscal_position_tax_model.loaded = function (self, fiscal_position_taxes) {
                fiscal_position_taxes = _.filter(fiscal_position_taxes, function (tax) {
                    return tax.tax_dest_id != false;
                });
                if (fiscal_position_taxes.length > 0) {
                    _super_account_fiscal_position_tax_model_loaded(self, fiscal_position_taxes);
                }
            };
            var pos_category_model = this.get_model('pos.category');
            var _super_loaded_pos_category_model = pos_category_model.loaded;
            pos_category_model.loaded = function (self, categories) {
                self.pos_categories = categories;
                self.pos_category_by_id = {};
                for (var i = 0; i < categories.length; i++) {
                    var category = categories[i];
                    self.pos_category_by_id[category.id] = category;
                }
                _super_loaded_pos_category_model(self, categories);
            };
            pos_category_model.fields = pos_category_model.fields.concat([
                'is_category_combo',
                'sale_limit_time',
                'from_time',
                'to_time',
                'submit_all_pos',
                'pos_branch_ids',
                'pos_config_ids',
            ])
            var product_model = this.get_model('product.product');
            product_model.fields.push(
                'name',
                'is_credit',
                'multi_category',
                'multi_uom',
                'multi_variant',
                'supplier_barcode',
                'is_combo',
                'combo_limit',
                'uom_po_id',
                'barcode_ids',
                'pos_categ_ids',
                'supplier_taxes_id',
                'volume',
                'weight',
                'description_sale',
                'description_picking',
                'type',
                'cross_selling',
                'standard_price',
                'pos_sequence',
                'is_voucher',
                'minimum_list_price',
                'sale_with_package',
                'qty_warning_out_stock',
                'write_date',
                'is_voucher',
                'combo_price',
                'pos_combo_categ_id',
                'is_combo_item',
                'name_second',
            );
            this.bus_location = null;
            var partner_model = this.get_model('res.partner');
            partner_model.fields.push(
                'ref',
                'vat',
                'comment',
                'discount_id',
                'credit',
                'debit',
                'balance',
                'limit_debit',
                'wallet',
                'property_product_pricelist',
                'property_payment_term_id',
                'is_company',
                'write_date',
                'birthday_date',
                'group_ids'
            );
            var pricelist_model = this.get_model('product.pricelist');
            pricelist_model['pricelist'] = true;
            var pricelist_item_model = this.get_model('product.pricelist.item');
            pricelist_item_model['pricelist'] = true;
            var payment_method_object = this.get_model('pos.payment.method');
            payment_method_object.fields.push('cash_journal_id');
            var res_users_object = this.get_model('res.users');
            res_users_object.fields.push('pos_security_pin');
            res_users_object.fields.push('barcode');
            res_users_object.fields.push('pos_config_id');
            res_users_object.fields.push('partner_id');
            var pos_session_model = this.get_model('pos.session');
            pos_session_model.fields.push('lock_state');
            _super_PosModel.initialize.apply(this, arguments);
            var wait_res_company = this.get_model('res.company');
            wait_res_company.fields.push('logo');
        },
        add_new_order: function () {
            var self = this;
            _super_PosModel.add_new_order.apply(this, arguments);
            var order = this.get_order();
            var client = order.get_client();
            if (!client && this.config.customer_default_id) {
                var client_default = this.db.get_partner_by_id(this.config.customer_default_id[0]);
                var order = this.get_order();
                if (client_default && order) {
                    setTimeout(function () {
                        order.set_client(client_default);
                    }, 500);
                }
            }
            if (!client && this.config.add_customer_before_products_already_in_shopping_cart) {
                setTimeout(function () {
                    self.gui.show_screen('clientlist');
                }, 500);
            }
        },
        formatDateTime: function (value, field, options) {
            if (value === false) {
                return "";
            }
            if (!options || !('timezone' in options) || options.timezone) {
                value = value.clone().add(session.getTZOffset(value), 'minutes');
            }
            return value.format(time.getLangDatetimeFormat());
        },
        format_date: function (date) { // covert datetime backend to pos
            if (date) {
                return this.formatDateTime(
                    moment(date), {}, {timezone: true});
            } else {
                return ''
            }
        },
        get_config: function () {
            return this.config;
        },
        get_packaging_by_product: function (product) {
            if (!this.packaging_by_product_id || !this.packaging_by_product_id[product.id]) {
                return false;
            } else {
                return true
            }
        },
        get_default_sale_journal: function () {
            var invoice_journal_id = this.config.invoice_journal_id;
            if (!invoice_journal_id) {
                return null
            } else {
                return invoice_journal_id[0];
            }
        },
        /*
            We not use exports.Product because if you have 1 ~ 10 millions data products
            Original function odoo will crashed browse memory
         */
        get_price: function (product, pricelist, quantity) {
            if (!quantity) {
                quantity = 1
            }
            if (!pricelist) {
                return product['lst_price'];
            }
            if (pricelist['items'] == undefined) {
                return product['lst_price'];
            }
            var date = moment().startOf('day');
            var category_ids = [];
            var category = product.categ;
            while (category) {
                category_ids.push(category.id);
                category = category.parent;
            }
            var pricelist_items = [];
            for (var i = 0; i < pricelist.items.length; i++) {
                var item = pricelist.items[i];
                if ((!item.product_tmpl_id || item.product_tmpl_id[0] === product.product_tmpl_id) &&
                    (!item.product_id || item.product_id[0] === self.id) &&
                    (!item.categ_id || _.contains(category_ids, item.categ_id[0])) &&
                    (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
                    (!item.date_end || moment(item.date_end).isSameOrAfter(date))) {
                    pricelist_items.push(item)
                }
            }
            var price = product['lst_price'];
            _.find(pricelist_items, function (rule) {
                if (rule.min_quantity && quantity < rule.min_quantity) {
                    return false;
                }
                if (rule.base === 'pricelist') {
                    price = this.get_price(rule.base_pricelist, quantity);
                } else if (rule.base === 'standard_price') {
                    price = product.standard_price;
                }
                if (rule.compute_price === 'fixed') {
                    price = rule.fixed_price;
                    return true;
                } else if (rule.compute_price === 'percentage') {
                    price = price - (price * (rule.percent_price / 100));
                    return true;
                } else {
                    var price_limit = price;
                    price = price - (price * (rule.price_discount / 100));
                    if (rule.price_round) {
                        price = round_pr(price, rule.price_round);
                    }
                    if (rule.price_surcharge) {
                        price += rule.price_surcharge;
                    }
                    if (rule.price_min_margin) {
                        price = Math.max(price, price_limit + rule.price_min_margin);
                    }
                    if (rule.price_max_margin) {
                        price = Math.min(price, price_limit + rule.price_max_margin);
                    }
                    return true;
                }
                return false;
            });
            return price;
        }
        ,
        /*
            This function return product amount with default tax set on product > sale > taxes
         */
        get_price_with_tax: function (product, pricelist) { // need refactor
            var price;
            if (pricelist) {
                price = this.get_price(product, pricelist, 1);
            } else {
                price = product['lst_price'];
            }
            var taxes_id = product['taxes_id'];
            if (!taxes_id) {
                return price;
            }
            var tax_amount = 0;
            var base_amount = product['lst_price'];
            if (taxes_id.length > 0) {
                for (var index_number in taxes_id) {
                    var tax = this.taxes_by_id[taxes_id[index_number]];
                    if ((tax && tax.price_include) || !tax) {
                        continue;
                    } else {
                        if (tax.amount_type === 'fixed') {
                            var sign_base_amount = base_amount >= 0 ? 1 : -1;
                            tax_amount += Math.abs(tax.amount) * sign_base_amount;
                        }
                        if ((tax.amount_type === 'percent' && !tax.price_include) || (tax.amount_type === 'division' && tax.price_include)) {
                            tax_amount += base_amount * tax.amount / 100;
                        }
                        if (tax.amount_type === 'percent' && tax.price_include) {
                            tax_amount += base_amount - (base_amount / (1 + tax.amount / 100));
                        }
                        if (tax.amount_type === 'division' && !tax.price_include) {
                            tax_amount += base_amount / (1 - tax.amount / 100) - base_amount;
                        }
                    }
                }
            }
            if (tax_amount) {
                return price + tax_amount
            } else {
                return price
            }
        }
        ,
        get_bus_location: function () {
            return this.bus_location
        }
        ,
        query_backend_fail: function (error) {
            if (error && error.message && error.message.code && error.message.code == 200) {
                return this.gui.show_popup('confirm', {
                    title: error.message.code,
                    body: error.message.data.message,
                })
            }
            if (error && error.message && error.message.code && error.message.code == -32098) {
                return this.gui.show_popup('confirm', {
                    title: error.message.code,
                    body: 'Your Odoo Server Offline',
                })
            } else {
                return this.gui.show_popup('confirm', {
                    title: 'Error',
                    body: 'Odoo offline mode or backend codes have issues. Please contact your admin system',
                })
            }
        }
        ,
        scan_product: function (parsed_code) {
            /*
                    This function only return true or false
                    Because if barcode passed mapping data of products, customers ... will return true
                    Else all return false and popup warning message
             */
            var self = this;
            console.log('-> scan barcode: ' + parsed_code.code);
            var product = this.db.get_product_by_barcode(parsed_code.code);
            var lot_by_barcode = this.lot_by_barcode;
            var lots = lot_by_barcode[parsed_code.code];
            var selectedOrder = this.get_order();
            var products_by_supplier_barcode = this.db.product_by_supplier_barcode[parsed_code.code];
            var barcodes = this.barcodes_by_barcode[parsed_code.code];
            var lots = _.filter(lots, function (lot) {
                var product_id = lot.product_id[0];
                var product = self.db.product_by_id[product_id];
                return product != undefined
            });
            var quantity_pack = _.find(this.quantities_pack, function (pack) {
                return pack.barcode == parsed_code.code;
            });
            if (quantity_pack) {
                var product_by_product_tmpl_id = _.find(this.pos.db.get_product_by_category(0), function (product) { // need check v10
                    return product.product_tmpl_id == quantity_pack['product_tmpl_id'][0];
                });
                if (product_by_product_tmpl_id) {
                    var product = self.db.product_by_id[product_by_product_tmpl_id.id];
                    if (product) {
                        selectedOrder.add_product(product, {quantity: quantity_pack.quantity, merge: true});
                        var order_line = selectedOrder.get_selected_orderline();
                        order_line.set_unit_price(quantity_pack['public_price']);
                        order_line.price_manually_set = true;
                        return true
                    }
                }
            }
            if (lots && lots.length) {
                if (lots.length > 1) {
                    var list = [];
                    for (var i = 0; i < lots.length; i++) {
                        list.push({
                            'label': lots[i]['name'],
                            'item': lots[i]
                        })
                    }
                    this.gui.show_popup('selection', {
                        title: _t('Select Lot'),
                        list: list,
                        confirm: function (lot) {
                            var product = self.db.product_by_id[lot.product_id[0]];
                            if (product) {
                                selectedOrder.add_product(product, {merge: false});
                                self.gui.close_popup();
                                var order_line = selectedOrder.get_selected_orderline();
                                if (order_line) {
                                    if (lot.replace_product_public_price && lot.public_price) {
                                        order_line.set_unit_price(lot['public_price'])
                                        order_line.price_manually_set = true;
                                    }
                                    $('.packlot-line-input').remove(); // fix on safari
                                    setTimeout(function () {
                                        var pack_models = order_line.pack_lot_lines.models;
                                        if (pack_model) {
                                            for (var i = 0; i < pack_models.length; i++) {
                                                var pack_model = pack_models[i];
                                                pack_model.set_lot_name(lot['name'], lot);
                                            }
                                            order_line.trigger('change', order_line);
                                        }
                                    }, 300);
                                }
                                return true
                            } else {
                                this.gui.show_popup('dialog', {
                                    title: 'Warning',
                                    body: 'Lot name is correct but product of lot not available on POS'
                                });
                                return false;
                            }
                        }
                    });
                    return true;
                } else if (lots.length == 1) {
                    var lot = lots[0];
                    var product = self.db.product_by_id[lot.product_id[0]];
                    if (product) {
                        selectedOrder.add_product(product, {merge: false});
                        self.gui.close_popup();
                        var order_line = selectedOrder.get_selected_orderline();
                        if (order_line) {
                            if (lot.replace_product_public_price && lot.public_price) {
                                order_line.set_unit_price(lot['public_price']);
                                order_line.price_manually_set = true;
                            }
                            $('.packlot-line-input').remove(); // fix on safari
                            setTimeout(function () {
                                var pack_models = order_line.pack_lot_lines.models;
                                if (pack_models) {
                                    for (var i = 0; i < pack_models.length; i++) {
                                        var pack_model = pack_models[i];
                                        pack_model.set_lot_name(lot['name'], lot);
                                    }
                                    order_line.trigger('change', order_line);
                                }
                            }, 300);
                        }
                        return true
                    } else {
                        return this.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Lot name is correct but product of lot not available on POS'
                        });
                    }
                }
            } else if (products_by_supplier_barcode) { // scan code by suppliers code
                var products = [];
                for (var i = 0; i < products_by_supplier_barcode.length; i++) {
                    products.push({
                        label: products_by_supplier_barcode[i]['display_name'],
                        item: products_by_supplier_barcode[i]
                    })
                }
                var product = this.db.get_product_by_barcode(parsed_code.code);
                if (product) {
                    products.push({
                        label: product['display_name'],
                        item: product
                    })
                }
                this.gui.show_popup('selection', {
                    title: _t('Select product'),
                    list: products,
                    confirm: function (product) {
                        var selectedOrder = self.get('selectedOrder');
                        if (selectedOrder) {
                            if (parsed_code.type === 'price') {
                                selectedOrder.add_product(product, {
                                    quantity: 1,
                                    price: product['lst_price'],
                                    merge: true
                                });
                            } else if (parsed_code.type === 'weight') {
                                selectedOrder.add_product(product, {
                                    quantity: 1,
                                    price: product['lst_price'],
                                    merge: false
                                });
                            } else if (parsed_code.type === 'discount') {
                                selectedOrder.add_product(product, {discount: parsed_code.value, merge: false});
                            } else {
                                selectedOrder.add_product(product);
                            }
                        }
                    }
                });
                return true
            } else if (product && barcodes) { // multi barcode, if have product and barcodes
                var list = [{
                    'label': product['name'] + '| price: ' + product['lst_price'] + ' | qty: 1 ' + '| and Uoms: ' + product['uom_id'][1],
                    'item': product,
                }];
                for (var i = 0; i < barcodes.length; i++) {
                    var barcode = barcodes[i];
                    list.push({
                        'label': barcode['product_id'][1] + '| price: ' + barcode['lst_price'] + ' | qty: ' + barcode['quantity'] + '| and Uoms: ' + barcode['uom_id'][1],
                        'item': barcode,
                    });
                }
                this.gui.show_popup('selection', {
                    title: _t('Select product'),
                    list: list,
                    confirm: function (item) {
                        var barcode;
                        var product;
                        if (item['product_id']) {
                            barcode = item;
                            product = self.db.product_by_id[barcode.product_id[0]]
                            selectedOrder.add_product(product, {
                                price: barcode['lst_price'],
                                quantity: barcode['quantity'],
                                extras: {
                                    uom_id: barcode['uom_id'][0]
                                }
                            });
                        } else {
                            product = item;
                            selectedOrder.add_product(product, {});
                        }
                    }
                });
                if (list.length > 0) {
                    return true;
                }
            } else if (!product && barcodes) { // not have product but have barcodes
                if (barcodes.length == 1) {
                    var barcode = barcodes[0]
                    var product = this.db.product_by_id[barcode['product_id'][0]];
                    if (product) {
                        selectedOrder.add_product(product, {
                            price: barcode['lst_price'],
                            quantity: barcode['quantity'],
                            extras: {
                                uom_id: barcode['uom_id'][0]
                            }
                        });
                        return true;
                    }
                } else if (barcodes.length > 1) { // if multi items the same barcode, require cashier select
                    var list = [];
                    for (var i = 0; i < barcodes.length; i++) {
                        var barcode = barcodes[i];
                        list.push({
                            'label': barcode['product_id'][1] + '| price: ' + barcode['lst_price'] + ' | qty: ' + barcode['quantity'] + '| and Uoms: ' + barcode['uom_id'][1],
                            'item': barcode,
                        });
                    }
                    this.gui.show_popup('selection', {
                        title: _t('Select product'),
                        list: list,
                        confirm: function (barcode) {
                            var product = self.db.product_by_id[barcode['product_id'][0]];
                            if (product) {
                                selectedOrder.add_product(product, {
                                    price: barcode['lst_price'],
                                    quantity: barcode['quantity'],
                                    extras: {
                                        uom_id: barcode['uom_id'][0]
                                    }
                                });
                            }
                        }
                    });
                    if (list.length > 0) {
                        return true;
                    }
                }
            }
            return _super_PosModel.scan_product.apply(this, arguments);
        },
        _save_to_server: function (orders, options) {
            if (this.hide_pads) {
                $('.pad').click();
            }
            if (options.draft && this.client_set_table) { // TODO: default pos odoo original allow sync to backend when installed pos_restaurant
                return Promise.resolve([]); // we blocked save draft order to backend if set table
            }
            return _super_PosModel._save_to_server.call(this, orders, options);
        },
        push_order: function (order, opts) {
            var pushed = _super_PosModel.push_order.apply(this, arguments);
            if (!order) {
                return pushed;
            }
            var client = order && order.get_client();
            if (client) {
                for (var i = 0; i < order.paymentlines.models.length; i++) {
                    var line = order.paymentlines.models[i];
                    var amount = line.get_amount();
                    var pos_method_type = line.payment_method.pos_method_type;
                    if (pos_method_type == 'wallet') {
                        client.wallet = -amount;
                    }
                    if (pos_method_type == 'credit') {
                        client.balance -= line.get_amount();
                    }
                }
            }
            return pushed;
        },
        get_balance: function (client) {
            var balance = round_pr(client.balance, this.currency.rounding);
            return (Math.round(balance * 100) / 100).toString()
        }
        ,
        get_wallet: function (client) {
            var wallet = round_pr(client.wallet, this.currency.rounding);
            return (Math.round(wallet * 100) / 100).toString()
        }
        ,
        add_return_order: function (order_return, lines) {
            var self = this;
            var order_return_id = order_return['id'];
            var order_selected_state = order_return['state'];
            var partner_id = order_return['partner_id'];
            var return_order_id = order_return['id'];
            var order = new models.Order({}, {pos: this});
            order['is_return'] = true;
            order['return_order_id'] = return_order_id;
            order['pos_reference'] = 'Return/' + order['name'];
            order['name'] = 'Return/' + order['name'];
            this.get('orders').add(order);
            if (partner_id && partner_id[0]) {
                var client = this.db.get_partner_by_id(partner_id[0]);
                if (client) {
                    order.set_client(client);
                }
            }
            this.set('selectedOrder', order);
            for (var i = 0; i < lines.length; i++) {
                var line_return = lines[i];
                if (line_return['is_return']) {
                    return this.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'This order is order return before, could made return again'
                    })
                }
                var price = line_return['price_unit'];
                if (price < 0) {
                    price = -price;
                }
                var quantity = 0;
                var product = this.db.get_product_by_id(line_return.product_id[0]);
                if (!product) {
                    console.error('Could not find product: ' + line_return.product_id[0]);
                    continue
                }
                var line = new models.Orderline({}, {
                    pos: this,
                    order: order,
                    product: product,
                });
                order.orderlines.add(line);
                if (line_return['variant_ids']) {
                    line.set_variants(line_return['variant_ids'])
                }
                if (line_return['tag_ids']) {
                    line.set_tags(line_return['tag_ids'])
                }
                line['returned_order_line_id'] = line_return['id'];
                line['is_return'] = true;
                line.set_unit_price(price);
                line.price_manually_set = true;
                if (line_return.discount)
                    line.set_discount(line_return.discount);
                if (line_return.discount_reason)
                    line.discount_reason = line_return.discount_reason;
                if (line_return['new_quantity']) {
                    quantity = -line_return['new_quantity']
                } else {
                    quantity = -line_return['qty']
                }
                if (quantity > 0) {
                    quantity = -quantity;
                }
                if (line_return.promotion) {
                    quantity = -quantity;
                }
                if (line_return.redeem_point) {
                    quantity = -quantity;
                    line.credit_point = line_return.redeem_point;
                }
                line.set_quantity(quantity, 'keep price when return');

            }
            if (this.combo_picking_by_order_id) {
                var combo_picking_id = this.combo_picking_by_order_id[return_order_id];
                if (combo_picking_id) {
                    moves = this.stock_moves_by_picking_id[combo_picking_id];
                    for (var n = 0; n < moves.length; n++) {
                        var price = 0;
                        var move = moves[n];
                        var product = this.db.get_product_by_id(move.product_id[0]);
                        if (!product) {
                            this.pos.gui.show_popup('dialog', {
                                title: 'Warning',
                                body: 'Product ID ' + move.product_id[1] + ' have removed out of POS. Take care'
                            });
                            continue
                        }
                        if (move.product_uom_qty == 0) {
                            continue
                        }
                        var line = new models.Orderline({}, {
                            pos: this,
                            order: order,
                            product: product,
                        });
                        order.orderlines.add(line);
                        line['is_return'] = true;
                        line.set_unit_price(price);
                        line.price_manually_set = true;
                        line.set_quantity(-move.product_uom_qty, 'keep price when return');
                    }
                }
            }

            if (order_selected_state.is_paid_full == false) {
                return new Promise(function (resolve, reject) {
                    rpc.query({
                        model: 'account.bank.statement.line',
                        method: 'search_read',
                        domain: [['pos_statement_id', '=', order_return_id]],
                        fields: [],
                    }).then(function (statements) {
                        var last_paid = 0;
                        for (var i = 0; i < statements.length; i++) {
                            var statement = statements[i];
                            last_paid += statement['amount'];
                        }
                        last_paid = self.gui.chrome.format_currency(last_paid);
                        self.gui.show_popup('dialog', {
                            'title': _t('Warning'),
                            'body': 'Selected Order need return is partial payment, and customer only paid: ' + last_paid + ' . Please return back money to customer correctly',
                        });
                        resolve()
                    }, function (error) {
                        reject()
                    })
                })
            } else {
                var payment_method = _.find(this.payment_methods, function (method) {
                    return method['journal'] && method['journal']['pos_method_type'] == 'default' && method['journal'].type == 'cash';
                });
                if (payment_method) {
                    order.add_paymentline(payment_method);
                    var amount_withtax = order.get_total_with_tax();
                    order.selected_paymentline.set_amount(amount_withtax);
                    order.trigger('change', order);
                    this.trigger('auto_update:paymentlines', this);
                }
            }
        },
        add_refill_order: function (order, lines) {
            var partner_id = order['partner_id'];
            var order = new models.Order({}, {pos: this});
            this.get('orders').add(order);
            if (partner_id && partner_id[0]) {
                var client = this.db.get_partner_by_id(partner_id[0]);
                if (client) {
                    order.set_client(client);
                }
            }
            this.set('selectedOrder', order);
            for (var i = 0; i < lines.length; i++) {
                var line_refill = lines[i];
                var price = line_refill['price_unit'];
                if (price < 0) {
                    price = -price;
                }
                var quantity = 0;
                var product = this.db.get_product_by_id(line_refill.product_id[0]);
                if (!product) {
                    console.error('Could not find product: ' + line_refill.product_id[0]);
                    continue
                }
                var line = new models.Orderline({}, {
                    pos: this,
                    order: order,
                    product: product,
                });
                order.orderlines.add(line);
                if (line_refill['variant_ids']) {
                    line.set_variants(line_refill['variant_ids'])
                }
                if (line_refill['tag_ids']) {
                    line.set_tags(line_refill['tag_ids'])
                }
                line.set_unit_price(price);
                line.price_manually_set = true;
                if (line_refill.discount)
                    line.set_discount(line_refill.discount);
                if (line_refill.discount_reason)
                    line.discount_reason = line_refill.discount_reason;
                if (line_refill['new_quantity']) {
                    quantity = line_refill['new_quantity']
                } else {
                    quantity = line_refill['qty']
                }
                line.set_quantity(quantity, 'keep price when return');
            }
        },
        lock_order: function () {
            $('.rightpane').addClass('oe_hidden');
            $('.buttons_pane').addClass('oe_hidden');
            $('.timeline').addClass('oe_hidden');
            $('.find_customer').addClass('oe_hidden');
            $('.leftpane').css({'left': '0px'});
            $('.numpad').addClass('oe_hidden');
            $('.actionpad').addClass('oe_hidden');
            $('.deleteorder-button').addClass('oe_hidden');
        },
        unlock_order: function () {
            if (this.config.mobile_responsive) {
                return;
            }
            $('.rightpane').removeClass('oe_hidden');
            $('.buttons_pane').removeClass('oe_hidden');
            $('.timeline').removeClass('oe_hidden');
            $('.find_customer').removeClass('oe_hidden');
            $('.numpad').removeClass('oe_hidden');
            $('.actionpad').removeClass('oe_hidden');
            if (this.config.staff_level == 'manager') {
                $('.deleteorder-button').removeClass('oe_hidden');
            }
        },
        load_server_data_by_model: function (model) {
            var self = this;

            var tmp = {};
            var fields = typeof model.fields === 'function' ? model.fields(self, tmp) : model.fields;
            var domain = typeof model.domain === 'function' ? model.domain(self, tmp) : model.domain;
            var context = typeof model.context === 'function' ? model.context(self, tmp) : model.context || {};
            var ids = typeof model.ids === 'function' ? model.ids(self, tmp) : model.ids;
            var order = typeof model.order === 'function' ? model.order(self, tmp) : model.order;

            var loaded = new Promise(function (resolve, reject) {
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
                rpc.query(params).then(function (result) {
                    try {    // catching exceptions in model.loaded(...)
                        Promise.resolve(model.loaded(self, result, tmp)).then(function () {
                            resolve()
                        }, function (err) {
                            reject(err);
                        });
                    } catch (err) {
                        reject()
                    }
                }, function (err) {
                    reject()
                });
            });
            return loaded;
        }
    });

    //TODO: validate click change minus
    var _super_NumpadState = models.NumpadState.prototype;
    models.NumpadState = models.NumpadState.extend({
        switchSign: function () {
            self.posmodel.switchSign = this;
            if (self.posmodel.config.validate_change_minus) {
                return self.posmodel.gui.show_popup('ask_password', {
                    title: 'Pos pass pin ?',
                    body: 'Please use pos security pin for unlock',
                    confirm: function (value) {
                        var pin;
                        if (self.posmodel.config.manager_validate) {
                            var user_validate = self.posmodel.user_by_id[this.pos.config.manager_user_id[0]];
                            pin = user_validate['pos_security_pin']
                        } else {
                            pin = self.posmodel.user.pos_security_pin
                        }
                        if (value != pin) {
                            return self.posmodel.gui.show_popup('dialog', {
                                title: 'Wrong',
                                body: 'Pos security pin not correct'
                            })
                        } else {
                            return _super_NumpadState.switchSign.apply(this.pos.switchSign, arguments);
                        }
                    }
                });
            } else {
                return _super_NumpadState.switchSign.apply(this, arguments);
            }
        }
    });

    var _super_product = models.Product.prototype; // TODO: only odoo 11 and 12 have this model, dont merge
    models.Product = models.Product.extend({
        get_price: function (pricelist, quantity) {
            if (!pricelist) {
                return this.lst_price;
            } else {
                return _super_product.get_price.apply(this, arguments);
            }
        }
    });
    var _super_Paymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        init_from_JSON: function (json) {
            var res = _super_Paymentline.init_from_JSON.apply(this, arguments);
            if (json.ref) {
                this.ref = json.ref
            }
            return res
        },
        export_as_JSON: function () {
            var json = _super_Paymentline.export_as_JSON.apply(this, arguments);
            if (this.ref) {
                json['ref'] = this.ref;
            }
            return json
        },
        export_for_printing: function () {
            var datas = _super_Paymentline.export_for_printing.apply(this, arguments);
            if (this.ref) {
                datas['ref'] = this.ref
            }
            return datas
        },
        set_reference: function (ref) {
            this.ref = ref;
            this.trigger('change', this)
        }
    });
})
;
