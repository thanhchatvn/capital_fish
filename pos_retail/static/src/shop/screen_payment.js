"use strict";
odoo.define('pos_retail.screen_payment', function (require) {

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var rpc = require('pos.rpc');
    var qweb = core.qweb;
    var BarcodeEvents = require('barcodes.BarcodeEvents').BarcodeEvents;

    screens.PaymentScreenWidget.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('auto_update:paymentlines', function () {
                self.order_changes();
            });
            if (this.pos.config.keyboard_event) { // add Keycode 27, back screen
                this.keyboard_keydown_handler = function (event) {
                    if (event.keyCode === 8 || event.keyCode === 46 || event.keyCode === 27) { // Backspace and Delete
                        event.preventDefault();
                        self.keyboard_handler(event);
                    }
                };
                this.keyboard_handler = function (event) {
                    if (BarcodeEvents.$barcodeInput && BarcodeEvents.$barcodeInput.is(":focus")) {
                        return;
                    }
                    var key = '';
                    if (event.type === "keypress") {
                        if (event.keyCode === 32) { // Space
                            self.validate_order();
                        } else if (event.keyCode === 190 || // Dot
                            event.keyCode === 188 ||  // Comma
                            event.keyCode === 46) {  // Numpad dot
                            key = self.decimal_point;
                        } else if (event.keyCode >= 48 && event.keyCode <= 57) { // Numbers
                            key = '' + (event.keyCode - 48);
                        } else if (event.keyCode === 45) { // Minus
                            key = '-';
                        } else if (event.keyCode === 43) { // Plus
                            key = '+';
                        } else if (event.keyCode == 100) { // d: add credit
                            $('.add_credit').click();
                        } else if (event.keyCode == 102) { // f: pay full
                            $('.paid_full').click();
                        } else if (event.keyCode == 112) {  // p: partial paid
                            $('.paid_partial').click();
                        } else if (event.keyCode == 98) {  // b: back screen
                            self.gui.back();
                        } else if (event.keyCode == 99) { // c: customer
                            $('.js_set_customer').click();
                        } else if (event.keyCode == 105) { // i: invoice
                            $('.js_invoice').click();
                        } else if (event.keyCode == 118) { // v: voucher
                            $('.input_voucher').click();
                            $('.js_create_voucher').click();
                        } else if (event.keyCode == 115) { // s: signature order
                            $('.js_signature_order').click();
                        } else if (event.keyCode == 110) { // n: note
                            $('.add_note').click();
                        } else if (event.keyCode == 109) { // n: note
                            $('.send_invoice_email').click();
                        } else if (event.keyCode == 119) { // w: note
                            $('.add_wallet').click();
                        }
                    } else { // keyup/keydown
                        if (event.keyCode === 46) { // Delete
                            key = 'CLEAR';
                        } else if (event.keyCode === 8) { // Backspace
                            key = 'BACKSPACE';
                        } else if (event.keyCode === 27) { // Backspace
                            self.gui.back();
                            self.pos.trigger('back:order');
                        }
                    }
                    self.payment_input(key);
                    event.preventDefault();
                };
            }
        },
        show: function () {
            this._super();
            this.reload_payment_methods();
            this.order_changes();
        },
        finalize_validation: function () {
            // TODO: if pos config missed setting Invoicing / Invoice Journal (invoice_journal_id)
            // We allow order continue and submit to backend without invoice
            var order = this.pos.get_order();
            var self = this;
            if (order.is_to_invoice()) {
                var invoice_journal_id = this.pos.config.invoice_journal_id;
                if (!invoice_journal_id) {
                    order.set_to_invoice(false);
                    return this.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Order set to invoice but POS config not setting Invoicing / Invoice Journal. If you wanted order submitted to backend without Invoice please confirm YES'),
                        confirm: function () {
                            return self.finalize_validation();
                        }
                    })
                } else {
                    this._super();
                }
            } else {
                this._super();
            }
        },
        render_paymentlines: function () {
            var self = this;
            this._super();
            this.$('.payment-ref-button').click(function () {
                self.hide();
                var line_cid = $(this).data('cid');
                var line = self.pos.get_order().get_paymentline(line_cid);
                if (line.amount == 0) {
                    self.hide();
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Please set amount before set payment reference'),
                        confirm: function () {
                            self.show();
                        },
                        cancel: function () {
                            self.show()
                        }
                    })
                }
                self.pos.gui.show_popup('textarea', {
                    title: _t('Set Reference to Payment Line selected'),
                    value: line.ref,
                    confirm: function (ref) {
                        line.set_reference(ref);
                        self.show();
                    },
                    cancel: function () {
                        self.show()
                    }
                });
            })
        },
        reload_payment_methods: function () {
            // TODO: reload payment methods element
            var methods = this.render_paymentmethods();
            this.$('.paymentmethods-container').empty();
            methods.appendTo(this.$('.paymentmethods-container'));
        },
        payment_input: function (input) {
            try {
                this._super(input);
            } catch (e) {
                this.reset_input();
            }
        },
        order_changes: function () {
            this._super();
            var order = this.pos.get_order();
            this.$('.add_wallet').removeClass('highlight');
            if (!order) {
                return;
            } else if (order.is_paid()) {
                var amount_due = order.get_due();
                this.$('.next_without_print_receipt').addClass('highlight');
                if (amount_due < 0) {
                    this.$('.add_wallet').addClass('highlight');
                }
            } else {
                this.$('.next_without_print_receipt').removeClass('highlight');
            }
        },
        click_set_customer: function () {
            var self = this;
            return this.gui.show_popup('popup_selection_extend', {
                title: _t('Request create Invoice, required select Customer'),
                fields: ['name', 'email', 'phone', 'mobile'],
                sub_datas: this.pos.db.get_partners_sorted(5),
                sub_search_string: this.pos.db.partner_search_string,
                sub_record_by_id: this.pos.db.partner_by_id,
                sub_template: 'clients_list',
                sub_button: '<div class="btn btn-success pull-right go_clients_screen">Go Clients Screen</div>',
                sub_button_action: function () {
                    self.pos.gui.show_screen('clientlist')
                },
                body: 'Please select one client',
                confirm: function (client_id) {
                    var client = self.pos.db.get_partner_by_id(client_id);
                    if (client) {
                        self.pos.gui.screen_instances["clientlist"]['new_client'] = client;
                        self.pos.trigger('client:save_changes');
                        self.show();
                    }
                }
            })
        },
        click_invoice: function () {
            var self = this;
            this._super();
            var order = this.pos.get_order();
            var invoice_journal_id = this.pos.config.invoice_journal_id;
            if (!invoice_journal_id) {
                order.set_to_invoice(false);
                this.$('.js_invoice').removeClass('highlight');
                return this.pos.gui.show_popup('error', {
                    title: _t('Warning'),
                    body: _t('Your pos setting not active Invoicing / Invoice Journal. Please close session and setup it before use this future')
                })
            }
            if (order.is_to_invoice()) {
                this.$('.js_invoice').addClass('highlight');
            } else {
                this.$('.js_invoice').removeClass('highlight');
            }
            if (order && !order.get_client() && order.is_to_invoice()) {
                this.click_set_customer();
            }
        },
        customer_changed: function () { // when client change, email invoice auto change
            this._super();
            var client = this.pos.get_client();
            var $send_invoice_email = this.$('.send_invoice_email');
            if (client && client.email) {
                if ($send_invoice_email && $send_invoice_email.length) {
                    $send_invoice_email.text(client ? client.email : _t('N/A'));
                }
            } else {
                if ($send_invoice_email && $send_invoice_email.length) {
                    $send_invoice_email.text('Email N/A');
                }
            }
        },
        click_invoice_journal: function (journal_id) { // change invoice journal when create invoice
            var order = this.pos.get_order();
            order['sale_journal'] = journal_id;
            order.trigger('change', order);
        },
        render_invoice_journals: function () { // render invoice journal, no use invoice journal default of pos
            var self = this;
            var methods = $(qweb.render('journal_list', {widget: this}));
            methods.on('click', '.journal', function () {
                self.click_invoice_journal($(this).data('id'));
            });
            return methods;
        },
        renderElement: function () {
            var self = this;
            if (this.pos.quickly_datas) {
                this.quickly_datas = this.pos.quickly_datas;
            } else {
                this.quickly_datas = []
            }
            this._super();
            if (this.pos.config.invoice_journal_ids && this.pos.config.invoice_journal_ids.length > 0 && this.pos.journals) {
                var methods = this.render_invoice_journals();
                methods.appendTo(this.$('.invoice_journals'));
            }
            var order = this.pos.get_order();
            if (!order) {
                return;
            }
            this.$('.add_note').click(function () { //TODO: Button add Note
                var order = self.pos.get_order();
                if (order) {
                    self.hide();
                    self.gui.show_popup('textarea', {
                        title: _t('Add Order Note'),
                        value: order.get_note(),
                        confirm: function (note) {
                            order.set_note(note);
                            order.trigger('change', order);
                            self.show();
                            self.renderElement();
                        },
                        cancel: function () {
                            self.show();
                            self.renderElement();
                        }
                    });
                }
            });
            this.$('.js_signature_order').click(function () { //TODO: Signature on Order
                var order = self.pos.get_order();
                self.hide();
                self.gui.show_popup('popup_order_signature', {
                    order: order,
                    confirm: function (rate) {
                        self.show();
                    },
                    cancel: function () {
                        self.show();
                    }
                });

            });
            this.$('.paid_full').click(function () { // payment full
                var order = self.pos.get_order();
                var selected_paymentline = order.selected_paymentline;
                if (!selected_paymentline) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please select Payment Method on right Page the first'
                    })
                } else {
                    selected_paymentline.set_amount(0);
                    var amount_due = order.get_due();
                    if (amount_due > 0) {
                        selected_paymentline.set_amount(amount_due);
                        self.order_changes();
                        self.render_paymentlines();
                        $('.paymentline.selected .edit').text(self.format_currency_no_symbol(amount_due));
                    } else {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Your Order payment full succeed, have not amount due'
                        })
                    }

                }
                // var order = self.pos.get_order();
                // var payment_method = _.find(self.pos.payment_methods, function (method) {
                //     return method.id == self.pos.config.paid_full_method_id[0];
                // });
                // var amount_due = order.get_due();
                // if (payment_method && amount_due > 0) {
                //     order.add_paymentline(payment_method);
                //     self.reset_input();
                //     self.payment_interface = payment_method.payment_terminal;
                //     if (self.payment_interface) {
                //         order.selected_paymentline.set_payment_status('pending');
                //     }
                //     var paymentline = order.selected_paymentline;
                //     paymentline.set_amount(amount_due);
                //     self.render_paymentlines();
                //     $('.paymentline.selected .edit').text(self.format_currency_no_symbol(amount_due));
                // } else {
                //     if (!payment_method) {
                //         self.pos.gui.show_popup('dialog', {
                //             title: 'Warning',
                //             body: 'Have not payment method have journal is cash and pos method is default'
                //         })
                //     }
                //     if (amount_due <= 0) {
                //         self.pos.gui.show_popup('dialog', {
                //             title: 'Warning',
                //             body: 'Order have paid full, could not add more'
                //         })
                //     }
                //
                // }
            });
            this.$('.paid_partial').click(function () { // partial payment
                var order = self.pos.get_order();
                var client = null;
                if (order) {
                    client = order.get_client();
                }
                if (!client) {
                    self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: "Required add client the first",
                    });
                    return self.pos.gui.show_screen('clientlist');
                }
                if (order.is_return || order.get_total_with_tax() <= 0) {
                    return self.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Order Return or Amount with tax smaller than 0 not allow do partial payment'),
                    });
                }
                order.partial_payment = true;
                order.trigger('change', order);
                self.pos.push_order(order, {draft: true});
                self.gui.show_screen('receipt');
            });
            this.$('.next_without_print_receipt').click(function () {
                var last_setting_auto_print_web_receipt = self.pos.config.auto_print_web_receipt;
                var is_valid = self.order_is_valid();
                if (is_valid) {
                    var order = self.pos.get_order();
                    order._printed = true;
                    self.pos.config.auto_print_web_receipt = false;
                    self.finalize_validation();
                }
            });
            this.$('.print_receipt_number').click(function () {
                return self.pos.gui.show_popup('number', {
                    title: 'How many Receipt wanted copy ?',
                    confirm: function (number) {
                        if (number > 0) {
                            self.pos.config.duplicate_receipt = true;
                        }
                        self.pos.config.print_number = number;
                        self.show();
                        self.renderElement();
                    },
                    cancel: function () {
                        self.show();
                        self.renderElement();
                    }
                })
            });
            this.$('.category_wise_receipt').click(function () {
                self.pos.config.category_wise_receipt = !self.pos.config.category_wise_receipt;
                self.show();
                self.renderElement();
            });
            this.$('.ticket_font_size').click(function () {
                return self.pos.gui.show_popup('number', {
                    title: 'Font Size of receipt you wanted',
                    confirm: function (number) {
                        number = parseInt(number)
                        if (number > 0) {
                            self.pos.config.ticket_font_size = number;
                        }
                        self.show();
                        self.renderElement();
                    },
                    cancel: function () {
                        self.show();
                        self.renderElement();
                    }
                })
            });
            this.$('.barcode-receipt').click(function () {
                self.pos.config.barcode_receipt = !self.pos.config.barcode_receipt;
                self.show();
                self.renderElement();
            });
            this.$('.auto_nextscreen_when_validate_payment').click(function () {
                self.pos.config.auto_nextscreen_when_validate_payment = !self.pos.config.auto_nextscreen_when_validate_payment;
                self.show();
                self.renderElement();
            });
            this.$('.auto_print_web_receipt').click(function () {
                self.pos.config.auto_print_web_receipt = !self.pos.config.auto_print_web_receipt;
                self.show();
                self.renderElement();
            });
            this.$('.add_wallet').click(function () { // add change amount to wallet card
                self.hide();
                var order = self.pos.get_order();
                var change = order.get_change();
                var wallet_journal = _.find(self.pos.account_journals, function (journal) {
                    return journal.pos_method_type == 'wallet'
                });
                if (!wallet_journal) {
                    self.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Your system missed add Wallet journal, please create journal wallet with pos method is wallet and add it to Payment Method',
                        confirm: function () {
                            self.show()
                        },
                        cancel: function () {
                            self.show()
                        }
                    })
                }
                var wallet_method = _.find(self.pos.payment_methods, function (method) {
                    return method.journal && method.journal['id'] == wallet_journal['id'];
                });
                if (!wallet_method) {
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Payment method Wallet have not add to your pos config, contact admin and add it before use this future',
                        confirm: function () {
                            self.show()
                        },
                        cancel: function () {
                            self.show()
                        }
                    })
                }
                if (order && !order.get_client()) {
                    self.pos.gui.show_screen('clientlist');
                    return self.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Required select customer for add Wallet Amount'),
                    });
                }
                if (!change || change == 0) {
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Order change empty'),
                        cancel: function () {
                            self.show();
                            self.renderElement();
                            self.order_changes();
                            return self.pos.gui.close_popup();
                        },
                        confirm: function () {
                            self.show();
                            self.renderElement();
                            self.order_changes();
                            return self.pos.gui.close_popup();
                        }
                    });
                }
                if (!order.finalized) {
                    self.gui.show_popup('number', {
                        'title': _t('How much amount wanted add to Wallet of ' + order.get_client['name']),
                        'value': change,
                        'confirm': function (value) {
                            if (value <= order.get_change()) {
                                order.add_paymentline(wallet_method);
                                var paymentline = order.selected_paymentline;
                                paymentline.set_amount(-value);
                                order.trigger('change', order);
                            } else {
                                self.pos.gui.show_popup('confirm', {
                                    title: _t('Warning'),
                                    body: _t('You could not set Wallet amount bigger than Change Amount'),
                                    cancel: function () {
                                        self.show();
                                        return self.pos.gui.close_popup();
                                    },
                                    confirm: function () {
                                        self.show();
                                        return self.pos.gui.close_popup();
                                    }
                                });
                            }
                            self.show();
                            self.renderElement();
                            self.order_changes();
                        },
                        cancel: function () {
                            self.show();
                            self.renderElement();
                        }
                    });
                }
            });
            this.$('.add_credit').click(function () { // add return amount to credit card
                var order = self.pos.get_order();
                order.add_order_credit();
            });
            this.$('.quickly-payment').click(function () { // Quickly Payment
                var quickly_payment_id = parseInt($(this).data('id'));
                var quickly_payment = self.pos.quickly_payment_by_id[quickly_payment_id];
                var order = self.pos.get_order();
                var cash_method = _.find(self.pos.payment_methods, function (method) {
                    return method.cash_journal_id
                });
                var selected_paymentline = order.selected_paymentline;
                if (selected_paymentline) {
                    var amount = quickly_payment['amount'] + selected_paymentline['amount'];
                    order.selected_paymentline.set_amount(amount);
                    self.render_paymentlines();
                    self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(amount));
                }
                if (!selected_paymentline && cash_method) {
                    order.add_paymentline(cash_method);
                    self.reset_input();
                    self.payment_interface = cash_method.payment_terminal;
                    if (self.payment_interface) {
                        order.selected_paymentline.set_payment_status('pending');
                    }
                    var selected_paymentline = order.selected_paymentline;
                    selected_paymentline.set_amount(quickly_payment['amount']);
                    self.render_paymentlines();
                    $('.paymentline.selected .edit').text(self.format_currency_no_symbol(quickly_payment['amount']));
                }
            });
            this.$('.send_invoice_email').click(function () { // input email send invoice
                var order = self.pos.get_order();
                var client = order.get_client();
                if (client) {
                    if (client.email) {
                        var email_invoice = order.is_email_invoice();
                        order.set_email_invoice(!email_invoice);
                        if (order.is_email_invoice()) {
                            self.$('.send_invoice_email').addClass('highlight');
                            if (!order.to_invoice) {
                                self.$('.js_invoice').click();
                            }
                        } else {
                            self.$('.send_invoice_email').removeClass('highlight');
                            if (order.to_invoice) {
                                self.$('.js_invoice').click();
                            }
                        }
                    } else {
                        self.pos.gui.show_screen('clientlist');
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Customer email is blank, please update'
                        })
                    }

                } else {
                    self.pos.gui.show_screen('clientlist');
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please select client the first'
                    })
                }
            });
        },
        validate_order: function (force_validation) {
            var order = this.pos.get_order();
            if (order.is_return) {
                if (order.paymentlines.models.length == 0) {
                    return this.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please choose Payment Method, before Submit Order'
                    })
                }
            }
            var wallet = 0;
            var use_wallet = false;
            var credit = 0;
            var use_credit = false;
            var payments_lines = order.paymentlines.models;
            var client = this.pos.get_order().get_client();
            if (client) {
                for (var i = 0; i < payments_lines.length; i++) {
                    var payment_line = payments_lines[i];
                    var cash_journal_id = payment_line.payment_method.cash_journal_id;
                    if (!cash_journal_id) {
                        continue
                    } else {
                        var journal = this.pos.journal_by_id[cash_journal_id[0]]
                        if (journal['pos_method_type'] == 'wallet') {
                            wallet += payment_line.get_amount();
                            use_wallet = true;
                        }
                        if (journal['pos_method_type'] == 'credit') {
                            credit += payment_line.get_amount();
                            use_credit = true;
                        }
                    }
                }
                if (client['wallet'] < wallet && use_wallet == true) {
                    return this.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: client.name + ' have Wallet Amount ' + ' only have ' + this.pos.chrome.format_currency(client['wallet']) + '. You could not set payment line amount bigger than ' + this.pos.chrome.format_currency(client['wallet'])
                    })
                }
                if (!order.is_return && client && (client['balance'] - credit < 0) && use_credit == true) {
                    return this.pos.gui.show_popup('dialog', {
                        title: _t('Error'),
                        body: client.name + ' have Credit Amount ' + this.pos.chrome.format_currency(client['balance']) + '. You could not set payment line amount bigger than ' + this.pos.chrome.format_currency(client['balance'])
                    })
                }
            }
            var total_payment = 0;
            if (order.paymentlines.models.length == 0 && order.get_total_with_tax() > 0) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Have not payment lines'
                })
            }
            for (var i = 0; i < order.paymentlines.models.length; i++) {
                var payment_line = order.paymentlines.models[i];
                total_payment += payment_line.amount;
            }
            if ((order.export_as_JSON()['amount_total'] - total_payment) > 0.00001) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Have difference payment amount with total amount, difference bigger than 0.00001'
                })
            }
            return this._super(force_validation);
        }
    });
});
