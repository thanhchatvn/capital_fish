"use strict";
odoo.define('pos_retail.screen_receipt', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;

    screens.ReceiptScreenWidget.include({
        init_pos_before_calling: function (pos) {
            this.pos = pos;
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back_order').click(function () {
                var order = self.pos.get_order();
                if (order) {
                    self.pos.gui.show_screen('products');
                }
            });
        },
        show: function () {
            var order = this.pos.get_order();
            if (this.pos.config.receipt_invoice_number && order && order.is_to_invoice()) {
                this.pos.config.iface_auto_print = false;
            }
            this._super();
        },
        print: function () {
            this._super();
        },
        handle_auto_print: function () {
            if (this.pos.config.auto_print_web_receip || this.pos.config.receipt_invoice_number) {
                return false
            } else {
                return this._super();
            }
        },
        should_auto_print: function () {
            if (!this.pos.get_order() || this.pos.config.auto_print_web_receip) { // TODO: if active both fuute 1. iface_prin_auto (odoo) and auto print of this module, will have issue
                return false
            } else {
                return this._super()
            }
        },
        render_change: function () {
            if (this.pos.get_order()) {
                return this._super();
            }
        },
        get_receipt_render_env: function () {
            var data_print = this._super();
            var orderlines_by_category_name = {};
            var order = this.pos.get_order();
            var orderlines = order.orderlines.models;
            var categories = [];
            if (this.pos.config.category_wise_receipt) {
                for (var i = 0; i < orderlines.length; i++) {
                    var line = orderlines[i];
                    var line_print = line.export_for_printing();
                    line['product_name_wrapped'] = line_print['product_name_wrapped'][0];
                    var pos_categ_id = line['product']['pos_categ_id'];
                    if (pos_categ_id && pos_categ_id.length == 2) {
                        var root_category_id = order.get_root_category_by_category_id(pos_categ_id[0]);
                        var category = this.pos.db.category_by_id[root_category_id];
                        var category_name = category['name'];
                        if (!orderlines_by_category_name[category_name]) {
                            orderlines_by_category_name[category_name] = [line];
                            var category_index = _.findIndex(categories, function (category) {
                                return category == category_name;
                            });
                            if (category_index == -1) {
                                categories.push(category_name)
                            }
                        } else {
                            orderlines_by_category_name[category_name].push(line)
                        }

                    } else {
                        if (!orderlines_by_category_name['None']) {
                            orderlines_by_category_name['None'] = [line]
                        } else {
                            orderlines_by_category_name['None'].push(line)
                        }
                        var category_index = _.findIndex(categories, function (category) {
                            return category == 'None';
                        });
                        if (category_index == -1) {
                            categories.push('None')
                        }
                    }
                }
            }
            data_print['orderlines_by_category_name'] = orderlines_by_category_name;
            data_print['categories'] = categories;
            data_print['total_paid'] = order.get_total_paid(); // save amount due if have (display on receipt of parital order)
            data_print['total_due'] = order.get_due(); // save amount due if have (display on receipt of parital order)
            data_print['invoice_number'] = order.invoice_number;
            return data_print
        },
        auto_next_screen: function () {
            var order = this.pos.get_order();
            var printed = false;
            if (order) {
                printed = order._printed;
            }
            if (this.pos.config.auto_print_web_receipt && !printed && order) {
                this.print();
                order._printed = true;

            }
            if (this.pos.config.auto_nextscreen_when_validate_payment && order) {
                this.click_next();
            }
        },
        actions_after_render_succeed_receipt: function () {
            if (this.pos.config.ticket_font_size) {
                this.$('.pos-receipt').css({'font-size': this.pos.config.ticket_font_size})
            }
            this.auto_next_screen();
        },
        render_receipt: function () {
            var self = this;
            $('.ui-helper-hidden-accessible').replaceWith();
            var order = this.pos.get_order();
            this.pos.report_html = qweb.render('OrderReceipt', this.get_receipt_render_env());
            if (this.pos.config.receipt_invoice_number && order.is_to_invoice()) {
                rpc.query({
                    model: 'pos.order',
                    method: 'search_read',
                    domain: [['ean13', '=', order['ean13']]],
                    fields: ['account_move'],
                }).then(function (orders) {
                    if (orders.length > 0 && orders[0]['account_move'] && orders[0]['account_move'][1]) {
                        var invoice_number = orders[0]['account_move'][1].split(" ")[0];
                        self.pos.get_order()['invoice_number'] = invoice_number;
                        console.log('Inv No. ' + invoice_number);
                    }
                    var env = self.get_receipt_render_env();
                    if (self.pos.config.duplicate_receipt && self.pos.config.print_number > 1) {
                        var contents = self.$('.pos-receipt-container');
                        contents.empty();
                        var i = 0;
                        while (i < self.pos.config.print_number) {
                            contents.append(qweb.render('OrderReceipt', env));
                            i++;
                        }
                    }
                    if (!self.pos.config.duplicate_receipt) {
                        self.$('.pos-receipt-container').html(qweb.render('OrderReceipt', env));
                    }
                    setTimeout(function () {
                        self.actions_after_render_succeed_receipt();
                    }, 1000)
                })
            } else {
                if (this.pos.config.duplicate_receipt && this.pos.config.print_number > 1) {
                    var contents = this.$('.pos-receipt-container');
                    contents.empty();
                    var i = 0;
                    var data = this.get_receipt_render_env();
                    while (i < this.pos.config.print_number) {
                        contents.append(qweb.render('OrderReceipt', data));
                        i++;
                    }
                    this.actions_after_render_succeed_receipt();
                } else {
                    this._super();
                    this.actions_after_render_succeed_receipt();
                }
            }
        },
    });
});
