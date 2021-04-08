"use strict";
odoo.define('pos_retail.screen_voucher', function (require) {

    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var qweb = core.qweb;
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('pos.rpc');
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;


    screens.ScreenWidget.include({
        show: function () {
            this._super();
            this.pos.barcode_reader.set_action_callback('voucher', _.bind(this.barcode_voucher_action, this));
        },
        barcode_voucher_action: function (datas) {
            var self = this;
            console.log('barcode_voucher_action(): ' + datas['code']);
            return new Promise(function (resolve, reject) {
                rpc.query({
                    model: 'pos.voucher',
                    method: 'get_voucher_by_code',
                    args: [datas['code']],
                }).then(function (voucher) {
                    if (voucher == -1) {
                        self.pos.gui.show_popup('confirm', {
                            title: 'Error',
                            body: 'Voucher Expired Date or Used before',
                        });
                        resolve(false);
                    } else {
                        var order = self.pos.get_order();
                        if (order) {
                            order.client_use_voucher(voucher)
                        }
                        resolve(true);
                    }
                }).catch(function (error) {
                    self.pos.gui.show_popup('dialog', {
                        title: 'Warning !',
                        body: 'Your odoo system have offline, or your internet have problem',
                    });
                    reject(error);
                });
            })
        }
    });

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        _flush_orders: function (orders, options) {
            var self = this;
            this.wait_print_voucher = false;
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i]['data'];
                for (var n = 0; n < order.lines.length; n++) {
                    var line = order.lines[n];
                    var product_id = line[2]['product_id'];
                    var product = this.db.get_product_by_id(product_id);
                    if (product.is_voucher || line.is_voucher) {
                        this.wait_print_voucher = true;
                    }
                }
            }
            return _super_PosModel._flush_orders.apply(this, arguments).then(function (order_ids) {
                if (self.wait_print_voucher) {
                    rpc.query({
                        model: 'pos.voucher',
                        method: 'get_vouchers_by_order_ids',
                        args: [[], order_ids]
                    }).then(function (vouchers_created) {
                        if (vouchers_created.length) {
                            self.wait_print_voucher = false;
                            self.vouchers_created = vouchers_created;
                            var selected_order = self.get_order();
                            if (selected_order) {
                                selected_order.finalize()
                            }
                            self.gui.show_screen(self.gui.startup_screen);
                            self.gui.show_screen('vouchers_screen');
                        }
                    })
                }
                return Promise.resolve(order_ids);
            })
        }
    });

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        init_from_JSON: function (json) {
            var res = _super_Order.init_from_JSON.apply(this, arguments);
            if (json.voucher) {
                this.voucher = json.voucher
            }
            if (json.create_voucher) {
                this.create_voucher = json.create_voucher
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Order.export_as_JSON.apply(this, arguments);
            if (this.voucher_id) {
                json.voucher_id = parseInt(this.voucher_id);
            }
            if (this.voucher) {
                json.voucher = this.voucher;
            }
            if (this.create_voucher) {
                json.create_voucher = this.create_voucher;
            }
            return json;
        },
        show_popup_create_voucher: function () {
            var self = this;
            var selected_line = this.selected_orderline;
            if (selected_line) {
                this.pos.gui.show_popup('popup_print_vouchers', {
                    'selected_line': selected_line,
                    'title': 'Please Input Information of Voucher will Create',
                    confirm: function (voucher) {
                        selected_line.voucher = voucher;
                    },
                    cancel: function () {
                        var order = self.pos.get_order();
                        if (order) {
                            order.remove_selected_orderline()
                        }
                    }
                });
            }
        },
        add_product: function (product, options) {
            var self = this;
            _super_Order.add_product.apply(this, arguments);
            if (product.is_voucher && this.pos.config.print_voucher) {
                this.show_popup_create_voucher();
            }
            if (product.is_voucher && !this.pos.config.print_voucher) {
                this.pos.gui.show_popup('confirm', {
                    title: _t('Error'),
                    body: _t('Product selected is voucher but your pos config not active Create/print voucher. Please check your pos config'),
                    confirm: function () {
                        var order = self.pos.get_order();
                        if (order) {
                            order.remove_selected_orderline()
                        }
                    },
                    cancel: function () {
                        var order = self.pos.get_order();
                        if (order) {
                            order.remove_selected_orderline()
                        }
                    }
                })
            }
        },
        get_order_is_create_voucher: function () {
            return this.create_voucher;
        },
        set_order_create_voucher: function () {
            this.create_voucher = !this.create_voucher;
            if (this.create_voucher) {
                this.add_credit = false;
                this.set_to_invoice(false);
            }
            this.trigger('change');
        },
        client_use_voucher: function (voucher) {
            this.voucher_id = voucher.id;
            var method = _.find(this.pos.payment_methods, function (method) {
                return method.pos_method_type == 'voucher';
            });
            if (method) {
                var due = this.get_due();
                if (voucher['customer_id'] && voucher['customer_id'][0]) {
                    var client = this.pos.db.get_partner_by_id(voucher['customer_id'][0]);
                    if (client) {
                        this.set_client(client)
                    }
                }
                var amount = 0;
                if (voucher['apply_type'] == 'fixed_amount') {
                    amount = voucher.value;
                } else {
                    amount = this.get_total_with_tax() / 100 * voucher.value;
                }
                if (amount <= 0) {
                    return this.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Voucher Used Full Amount, please use another Voucher',
                    });
                }
                this.add_paymentline(method);
                var voucher_paymentline = this.selected_paymentline;
                voucher_paymentline['voucher_id'] = voucher['id'];
                voucher_paymentline['voucher_code'] = voucher['code'];
                var voucher_amount = 0;
                if (amount >= due) {
                    voucher_amount = due;
                } else {
                    voucher_amount = amount;
                }
                if (voucher_amount > 0) {
                    voucher_paymentline.set_amount(voucher_amount);
                    this.trigger('change', this);
                    $('.paymentline.selected .edit').text(this.pos.chrome.format_currency_no_symbol(voucher_amount));
                } else {
                    this.pos.gui.show_popup('confirm', {
                        title: 'Warning !',
                        body: 'Selected Order Paid Full, Could not adding more Voucher Value',
                    });
                }
            } else {
                this.pos.gui.show_popup('confirm', {
                    title: 'Warning !',
                    body: 'Your Odoo have removed Payment Method Voucher',
                });
            }
        }
    });

    var _super_Orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function (attributes, options) {
            var res = _super_Orderline.initialize.apply(this, arguments);
            if (!this.voucher) {
                this.voucher = {};
            }
            return res;
        },
        init_from_JSON: function (json) {
            var res = _super_Orderline.init_from_JSON.apply(this, arguments);
            if (json.voucher) {
                this.voucher = json.voucher
            }
            return res
        },
        export_as_JSON: function () {
            var json = _super_Orderline.export_as_JSON.apply(this, arguments);
            if (this.voucher) {
                json.voucher = this.voucher;
            }
            return json;
        },
        export_for_printing: function () {
            var receipt_line = _super_Orderline.export_for_printing.apply(this, arguments);
            if (this.voucher) {
                receipt_line['voucher'] = this.voucher;
            }
            return receipt_line
        }
    });

    var _super_Paymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        init_from_JSON: function (json) {
            var res = _super_Paymentline.init_from_JSON.apply(this, arguments);
            if (json.voucher_id) {
                this.voucher_id = json.voucher_id
            }
            if (json.voucher_code) {
                this.voucher_code = json.voucher_code
            }
            return res
        },
        export_as_JSON: function () {
            var json = _super_Paymentline.export_as_JSON.apply(this, arguments);
            if (this.voucher_id) {
                json['voucher_id'] = this.voucher_id;
            }
            if (this.voucher_code) {
                json['voucher_code'] = this.voucher_code;
            }
            return json
        },
        export_for_printing: function () {
            var datas = _super_Paymentline.export_for_printing.apply(this, arguments);
            if (this.voucher_code) {
                datas['voucher_code'] = this.voucher_code
            }
            return datas
        }
    });

    screens.PaymentScreenWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.js_create_voucher').click(function () { // create voucher
                var selected_order = self.pos.get_order();
                return selected_order.set_order_create_voucher();
            });
            this.$('.input_voucher').click(function () { // input manual voucher
                self.hide();
                return self.pos.gui.show_popup('alert_input', {
                    title: _t('Voucher'),
                    body: _t('Please input code or number of voucher.'),
                    confirm: function (code) {
                        self.show();
                        self.renderElement();
                        if (!code) {
                            return false;
                        } else {
                            return rpc.query({
                                model: 'pos.voucher',
                                method: 'get_voucher_by_code',
                                args: [code],
                            }).then(function (voucher) {
                                if (voucher == -1) {
                                    return self.gui.show_popup('confirm', {
                                        title: 'Error',
                                        body: 'Voucher used full valume or does not exist',
                                    });
                                } else {
                                    var order = self.pos.get_order();
                                    if (order) {
                                        order.client_use_voucher(voucher)
                                    }
                                }
                            }, function (err) {
                                return self.pos.query_backend_fail(error);
                            })
                        }
                    },
                    cancel: function () {
                        self.show();
                        self.renderElement();
                    }
                });
            });
        },
    });

    var vouchers_screen = screens.ScreenWidget.extend({
        template: 'vouchers_screen',

        show: function () {
            this._super();
            this.vouchers = this.pos.vouchers_created;
            if (this.vouchers) {
                this.render_vouchers();
            }
            this.handle_auto_print();
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
                if (this.should_close_immediately()) {
                    this.click_back();
                }
            } else {
                this.lock_screen(false);
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto;
        },
        should_close_immediately: function () {
            return this.pos.proxy.printer;
        },
        lock_screen: function (locked) {
            this.$('.back').addClass('highlight');
        },
        get_voucher_env: function (voucher) {
            var cashier = this.pos.get_cashier();
            var company = this.pos.company;
            return {
                widget: this,
                pos: this.pos,
                cashier: cashier,
                company: company,
                voucher: voucher
            };
        },
        print_web: function () {
            window.print();
        },
        print_html: function () {
            if (this.vouchers) {
                for (var i = 0; i < this.vouchers.length; i++) {
                    var voucher_xml = qweb.render('voucher_ticket_html', this.get_voucher_env(this.vouchers[i]));
                    this.pos.proxy.print_receipt(voucher_xml);
                }
            }
        },
        print: function () {
            var self = this;
            if (this.pos.proxy.printer && this.pos.proxy.print_receipt) {
                this.print_html();
                this.lock_screen(false);
            } else {
                this.print_web();
            }
        },
        click_back: function () {
            var default_screen = this.pos.gui.startup_screen;
            this.pos.gui.show_screen(default_screen);
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                self.click_back();
            });
            this.$('.button.print').click(function () {
                self.print();
            });
        },
        render_change: function () {
            this.$('.change-value').html(this.format_currency(this.pos.get_order().get_change()));
        },
        render_vouchers: function () {
            var $voucher_content = this.$('.pos-receipt-container');
            var url_location = window.location.origin + '/report/barcode/EAN13/';
            $voucher_content.empty();
            if (this.vouchers) {
                for (var i = 0; i < this.vouchers.length; i++) {
                    this.vouchers[i]['url_barcode'] = url_location + this.vouchers[i]['code'];
                    $voucher_content.append(
                        qweb.render('voucher_ticket_html', this.get_voucher_env(this.vouchers[i]))
                    );
                }
            }
        }
    });
    gui.define_screen({name: 'vouchers_screen', widget: vouchers_screen});

    var popup_print_vouchers = PopupWidget.extend({
        template: 'popup_print_vouchers',
        show: function (options) {
            this.selected_line = options.selected_line;
            this.options = options;
            this._super(options);
        },
        click_confirm: function () {
            var order = this.pos.get_order();
            var selected_line = this.selected_line;
            var voucher_amount = selected_line.get_price_with_tax();
            var number = parseFloat(this.$('input[name="number"]').val());
            var period_days = parseFloat(this.$('input[name="period_days"]').val());
            var apply_type = this.$('.apply_type').val();
            var method = this.$('.method').val();
            var customer = order.get_client();
            if (method == "special_customer" && !customer) {
                this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Because apply to special customer, required select customer the first'
                });
                return this.pos.gui.show_screen('clientlist')
            }
            if (isNaN(number)) {
                return this.wrong_input('input[name="number"]', "(*) Card Number is Required");
            } else {
                this.passed_input('input[name="number"]');
            }
            if (typeof period_days != 'number' || isNaN(period_days) || period_days <= 0) {
                return this.wrong_input('input[name="period_days"]', "(*) Period Days is Required and Bigger than 0");
            } else {
                this.passed_input('input[name="period_days"]');
            }
            if (typeof voucher_amount != 'number' || isNaN(voucher_amount) || voucher_amount <= 0) {
                return this.wrong_input('input[name="voucher_amount"]', "(*) Amount is Required and bigger than 0");
            } else {
                this.passed_input('input[name="voucher_amount"]');
            }
            var voucher_data = {
                apply_type: apply_type,
                value: voucher_amount,
                method: method,
                period_days: period_days,
                number: number
            };
            if (customer) {
                voucher_data['customer_id'] = customer['id'];
            }
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, voucher_data);
            }
        },
        click_cancel: function () {
            this.gui.close_popup();
            if (this.options.cancel) {
                this.options.cancel.call(this);
            }
        },
    });
    gui.define_popup({
        name: 'popup_print_vouchers',
        widget: popup_print_vouchers
    });

    screens.OrderWidget.include({
        remove_orderline: function (order_line) {
            try {
                this._super(order_line);
            } catch (ex) {
                console.log('dont worries, client without table select');
            }
        }
    });

    var button_print_vouchers = screens.ActionButtonWidget.extend({
        template: 'button_print_vouchers',
        button_click: function () {
            if (this.pos.vouchers_created) {
                return this.pos.gui.show_screen('vouchers_screen')
            } else {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Have not any vouchers create before'
                })
            }
        }
    });

    screens.define_action_button({
        'name': 'button_print_vouchers',
        'widget': button_print_vouchers,
        'condition': function () {
            return this.pos.config.print_voucher;
        }
    });

    var popup_manual_create_voucher = PopupWidget.extend({
        template: 'popup_manual_create_voucher',
        show: function (options) {
            var self = this;
            this.options = options;
            this.options.value = round_pr(options.line_selected.reduce((function (sum, line) {
                if (line.new_quantity) {
                    return sum + (line.price_subtotal_incl / line.qty * line.new_quantity);
                } else {
                    return sum + line.price_subtotal_incl;
                }
            }), 0), this.pos.currency.rounding);
            if (this.options.order.partner_id) {
                var partner_id = this.options.order.partner_id[0];
                this.options.client = this.pos.db.get_partner_by_id(partner_id);
            }
            this._super(options);
            this.$('.print-voucher').click(function () {
                var fields = {};
                self.$('.voucher-field').each(function (idx, el) {
                    fields[el.name] = el.value || false;
                });
                fields['period_days'] = parseFloat(fields['period_days']);
                fields['value'] = parseFloat(fields['value']);
                if (!fields['number']) {
                    return self.wrong_input('input[name="number"]', "(*) Card Number is Required");
                }
                if (fields['customer_id']) {
                    fields['customer_id'] = parseInt(fields['customer_id']);
                }
                return new Promise(function (resolve, reject) {
                    rpc.query({
                        model: 'pos.voucher',
                        method: 'order_return_become_voucher',
                        args: [[], fields]
                    }).then(function (voucher_val) {
                        self.pos.vouchers_created = [voucher_val];
                        self.gui.show_screen(self.gui.startup_screen);
                        self.gui.show_screen('vouchers_screen');
                        resolve()
                    }, function (err) {
                        reject()
                    })
                })
            });
            this.$('.cancel').click(function () {
                self.click_cancel();
            });
        }
    });
    gui.define_popup({
        name: 'popup_manual_create_voucher',
        widget: popup_manual_create_voucher
    });
});
