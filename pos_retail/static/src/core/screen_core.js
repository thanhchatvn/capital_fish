"use strict";
odoo.define('pos_retail.screen_core', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var qweb = core.qweb;

    screens.NumpadWidget.include({
        hide_pad: function () {
            $('.subwindow-container-fix .pads').animate({height: 0}, 'fast');
            $('.numpad').addClass('oe_hidden');
            $('.show_hide_pad').toggleClass('fa-caret-down fa-caret-up');
            $('.actionpad').addClass('oe_hidden');
            $('.mode-button').addClass('oe_hidden');
            this.pos.hide_pads = true;
        },
        show_pad: function () {
            $('.subwindow-container-fix .pads').animate({height: '100%'}, 'fast');
            $('.mode-button').removeClass('oe_hidden');
            $('.actionpad').removeClass('oe_hidden');
            $('.pads').animate({height: '100%'}, 'fast');
            $('.show_hide_pad').toggleClass('fa-caret-down fa-caret-up');
            $('.numpad').removeClass('oe_hidden');
            this.pos.hide_pads = false;
        },
        renderElement: function () {
            var self = this;
            this._super();
            $('.pad').click(function () {
                if (!self.pos.hide_pads || self.pos.hide_pads == false) {
                    self.hide_pad();
                } else {
                    self.show_pad();
                }
            });
            this.pos.bind('change:selectedOrder', function () {
                if (self.pos.hide_pads) {
                    self.hide_pad();
                }
            }, this);
        },
        clickChangeMode: function (event) {
            var self = this;
            var newMode = event.currentTarget.attributes['data-mode'].nodeValue;
            var order = this.pos.get_order();
            if (!order) {
                return this._super(event);
            }
            var line_selected = order.get_selected_orderline();
            if (!line_selected) {
                return this._super(event);
            }
            var is_return = order['is_return'];
            if (newMode == 'quantity' && this.pos.config.validate_quantity_change) {
                if (is_return) {
                    if (!this.pos.config.apply_validate_return_mode) {
                        return this._super(event);
                    } else {
                        this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('quantity')");
                    }
                } else {
                    this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('quantity')");
                }
            }
            if (newMode == 'discount' && this.pos.config.validate_discount_change) {
                if (is_return) {
                    if (!this.pos.config.apply_validate_return_mode) {
                        return this._super(val);
                    } else {
                        this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('discount')");
                    }
                } else {
                    this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('discount')");
                }
            }
            if (newMode == 'price' && this.pos.config.validate_price_change) {
                if (is_return) {
                    if (!this.pos.config.apply_validate_return_mode) {
                        return this._super(val);
                    } else {
                        this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('price')");
                    }

                } else {
                    this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('price')");
                }
            }
            return this._super(event);
        }
    });

    screens.ActionButtonWidget.include({
        highlight: function (highlight) {
            this._super(highlight);
            if (highlight) {
                this.$el.addClass('highlight');
            } else {
                this.$el.removeClass('highlight');
            }
        },
        altlight: function (altlight) {
            this._super(altlight);
            if (altlight) {
                this.$el.addClass('btn-info');
            } else {
                this.$el.removeClass('btn-info');
            }
        },
        invisible: function () {
            this.$el.addClass('oe_hidden');
        },
        display: function () {
            this.$el.removeClass('oe_hidden');
        }
    });

    screens.ScreenWidget.include({
        _check_is_duplicate: function (field_value, field_string, id) {
            var partners = this.pos.db.get_partners_sorted(-1);
            if (id) {
                var old_partners = _.filter(partners, function (partner_check) {
                    return partner_check['id'] != id && partner_check[field_string] == field_value;
                });
                if (old_partners.length != 0) {
                    return true
                } else {
                    return false
                }
            } else {
                var old_partners = _.filter(partners, function (partner_check) {
                    return partner_check[field_string] == field_value;
                });
                if (old_partners.length != 0) {
                    return true
                } else {
                    return false
                }
            }
        },
        validate_date_field: function (value, $el) {
            if (value.match(/^\d{4}$/) !== null) {
                $el.val(value + '-');
            } else if (value.match(/^\d{4}\/\d{2}$/) !== null) {
                $el.val(value + '-');
            }
        },
        check_is_number: function (number) {
            var regex = /^[0-9]+$/;
            if (number.match(regex)) {
                return true
            } else {
                return false
            }
        },
        wrong_input: function (element, message) {
            if (message) {
                this.$("span[class='card-issue']").text(message);
            }
            this.$el.find(element).css({
                'box-shadow': '0px 0px 0px 1px rgb(236, 5, 5) inset',
                'border': 'none !important',
                'border-bottom': '1px solid red !important'
            });
        },
        passed_input: function (element) {
            this.$el.find(element).css({
                'box-shadow': '#3F51B5 0px 0px 0px 1px inset'
            })
        },
        show: function () {
            var self = this;
            this._super();
            $('.pos-logo').replaceWith();
            // this.pos.barcode_reader.set_action_callback('order', _.bind(this.scan_order_and_return, this));
            // this.pos.barcode_reader.set_action_callback('fast_order_number', _.bind(this.barcode_fast_order_number, this));
            if (this.pos.config.is_customer_screen) {
                $('.debug-widget').css('display', 'none');
                $('.pos .order-selector').css('display', 'none');
                $('.pos .leftpane').css('left', '0px');
                $('.pos .rightpane').css('left', '440px');
                $('.username').replaceWith();
                $('.js_synch').replaceWith();
                $('.oe_icon').css("padding-right", '60px');
                $('.pos-rightheader').css("right", '0px');
                $('.pos-rightheader').css("float", 'right');
                $('.pos-rightheader').css("left", '0px');
                $('.find_customer').replaceWith();
                $('.full-content').css("top", '10px');
                $('.show_hide_buttons').remove();
                $('.layout-table').replaceWith();
                $('.buttons_pane').replaceWith();
                $('.collapsed').replaceWith();
                var image_url = window.location.origin + '/web/image?model=pos.config.image&field=image&id=';
                var images = self.pos.images;
                for (var i = 0; i < images.length; i++) {
                    images[i]['image_url'] = 'background-image:url(' + image_url + images[i]['id'] + ')';
                }
                this.$('.rightpane').append(qweb.render('customer_screen', {
                    widget: this,
                    images: images
                }));
                new Swiper('.gallery-top', {
                    spaceBetween: 10,
                    speed: this.pos.config.delay,
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev'
                    },
                    autoplay: {
                        delay: 4000,
                        disableOnInteraction: false
                    }
                });
                new Swiper('.gallery-thumbs', {
                    speed: this.pos.config.delay,
                    spaceBetween: 10,
                    centeredSlides: true,
                    slidesPerView: 'auto',
                    touchRatio: 0.2,
                    slideToClickedSlide: true,
                    autoplay: {
                        delay: 4000,
                        disableOnInteraction: false
                    }
                });
                this.$('.gallery-thumbs').css('display', 'none');
                this.$('.swiper-slide').css('width', '100%');
                this.$('.swiper-slide').css('height', '100%');
                this.$('.swiper-slide').css('max-width', '100%');
                this.$('.swiper-slide').css('max-height', '100%');
                this.$('.swiper-slide').css('margin', '0px');
                this.$('.swiper-slide').css('background-position', 'center');
                this.$('.swiper-slide').css('background-repeat', 'no-repeat');
                this.$('.swiper-slide').css('background-size', 'cover');
                this.$('.swiper-wrapper').css('width', '100%');
            }
        },
        scan_booked_order: function (datas_code) {
            var sale = this.pos.db.sale_order_by_ean13[datas_code.code];
            if (sale) {
                this.gui.screen_instances['sale_orders'].display_sale_order(sale);
                return true
            } else {
                return false
            }
        },
        barcode_product_action: function (code) {
            var current_screen = this.pos.gui.get_current_screen();
            var scan_sussess = false;
            if (current_screen && current_screen == 'return_products') {
                this.scan_return_product(code);
                scan_sussess = this.scan_return_product(code);
            }
            if (current_screen == 'sale_orders') {
                scan_sussess = this.scan_booked_order(code)
            }
            if (current_screen != 'return_products' && current_screen != 'sale_orders' && !scan_sussess) {
                return this._super(code)
            }
        },
        scan_order_and_paid: function (datas_code) {
            if (datas_code && datas_code['type']) {
                var code = datas_code['code'];
                console.log('{scanner} code: ' + code);
                var orders = this.pos.get('orders').models;
                var order = _.find(orders, function (order) {
                    return order.index_number_order == code;
                });
                if (order) {
                    this.pos.set('selectedOrder', order);
                    this.pos.gui.show_screen('payment');
                    return true;
                } else {
                    return false
                }
            } else {
                return false;
            }
        },
        scan_order_and_return: function (datas_code) {
            if (datas_code && datas_code['type']) {
                console.log('{scanner} return order code: ' + datas_code.code);
            }
            var ean13 = datas_code['code'];
            if (ean13.length == 12)
                ean13 = "0" + ean13;
            var order = this.pos.db.order_by_ean13[ean13];
            if (!order || order.length > 1) {
                return false; // could not find order
            }
            var order_lines = this.pos.db.lines_by_order_id[order['id']];
            if (!order_lines) {
                return false;
            } else {
                this.gui.show_popup('popup_return_pos_order_lines', {
                    title: order.name,
                    order_lines: order_lines,
                    order: order
                });
                return true
            }
        },
        barcode_error_action: function (datas_code_wrong) {
            var check_is_return_order = this.scan_order_and_return(datas_code_wrong);
            if (!check_is_return_order) {
                var fast_selected_order = this.scan_order_and_paid(datas_code_wrong);
                if (!fast_selected_order) {
                    return this._super(datas_code_wrong)
                }
            }
        }
    });

    screens.ScaleScreenWidget.include({
        _get_active_pricelist: function () {
            var current_order = this.pos.get_order();
            var current_pricelist = this.pos.default_pricelist;
            if (current_order && current_order.pricelist) {
                return this._super()
            } else {
                return current_pricelist
            }
        },
        _get_default_pricelist: function () {
            var current_pricelist = this.pos.default_pricelist;
            return current_pricelist
        }
    });
    screens.ActionpadWidget.include({
        /*
                validation payment
                auto ask need apply promotion
                auto ask when have customer special discount
         */
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.add-new-customer').click(function () {
                self.pos.gui.show_popup('popup_create_customer', {
                    title: 'Add customer'
                })
            });
            this.$('.find-order').click(function () {
                self.pos.show_purchased_histories();
            });
            this.$('.quickly_paid').click(function () { // refactor ????
                if (!self.pos.config.quickly_payment_full_method_id) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Error',
                        body: 'Your POS Config not set Payment Method, please go to Accounting/Invoice tab, Quickly Paid Full and Payment Method fields and setting again'
                    })
                }
                var order = self.pos.get_order();
                if (!order) {
                    return;
                }
                if (order.orderlines.length == 0) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Error',
                        body: 'Your order lines is blank'
                    })
                }
                var paymentlines = order.get_paymentlines();
                for (var i = 0; i < paymentlines.length; i++) {
                    paymentlines[i].destroy();
                }
                var payment_method = _.find(self.pos.payment_methods, function (method) {
                    return method.id == self.pos.config.quickly_payment_full_method_id[0];
                });
                if (!payment_method) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Error',
                        body: 'Could not find Payment Method ' + self.pos.config.quickly_payment_full_method_id[1],
                    })
                }
                var amount_due = order.get_due();
                order.add_paymentline(payment_method);
                var payment_interface = payment_method.payment_terminal;
                if (payment_interface) {
                    order.selected_paymentline.set_payment_status('pending');
                }
                var paymentline = order.selected_paymentline;
                paymentline.set_amount(amount_due);
                self.pos.push_order(order);
                self.pos.gui.show_screen('receipt');
            });
            this.$('.pay').click(function () {
                var order = self.pos.get_order();
                order.validate_payment_order();
            });
            // TODO: quickly select partner
            this.$('.set-customer').click(function () {
                self.pos.show_popup_clients('products');
            });
        }
    });

    var ReviewReceiptScreen = screens.ScreenWidget.extend({
        template: 'ReviewReceiptScreen',
        show: function () {
            this._super();
            var self = this;
            this.render_change();
            this.render_receipt();
            this.handle_auto_print();
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto;
        },
        should_close_immediately: function () {
            return this.pos.proxy.printer && this.pos.config.iface_print_skip_screen;
        },
        lock_screen: function (locked) {
            this._locked = locked;
            if (locked) {
                this.$('.back').removeClass('highlight');
            } else {
                this.$('.back').addClass('highlight');
            }
        },
        print_web: function () {
            window.print();
            this.pos.get_order()._printed = true;
        },
        print_html: function () { // refactor
            var receipt = qweb.render('OrderReceipt', this.pos.gui.screen_instances['receipt'].get_receipt_render_env());
            this.pos.proxy.print_receipt(receipt);
            this.pos.get_order()._printed = true;
        },
        print: function () {
            if (this.pos.proxy.printer && this.pos.proxy.print_receipt) {
                this.print_html();
                this.lock_screen(false);
            } else {
                this.print_web();
            }
        },

        click_back: function () {
            this.pos.gui.show_screen('products')
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                if (!self._locked) {
                    self.click_back();
                }
                self.pos.trigger('back:order');
            });
            this.$('.button.print').click(function () {
                if (!self._locked) {
                    self.print();
                }
            });
        },
        render_change: function () {
            this.$('.change-value').html(this.format_currency(this.pos.get_order().get_change()));
        },
        render_receipt: function () {
            var receipt = qweb.render('OrderReceipt', this.pos.gui.screen_instances['receipt'].get_receipt_render_env());
            this.$('.pos-receipt-container').html(receipt);
            if (this.pos.config.ticket_font_size) {
                this.$('.pos-receipt').css({'font-size': this.pos.config.ticket_font_size})
            }
        }
    });

    gui.define_screen({name: 'review_receipt', widget: ReviewReceiptScreen});

    return {
        'ReviewReceiptScreen': ReviewReceiptScreen
    }
});
