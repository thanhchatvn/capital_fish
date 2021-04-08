odoo.define('pos_retail.chromes', function (require) {
    "use strict";

    var chrome = require('point_of_sale.chrome');
    var gui = require('point_of_sale.gui');

    // TODO: for waiters and cashiers
    _.each(chrome.Chrome.prototype.widgets, function (widget) {
        if (['sale_details', 'notification', 'proxy_status', 'screen_status', 'username'].indexOf(widget['name']) != -1) {
            widget['append'] = '.pos-branding';

        }
    });

    var button_list_widget = chrome.StatusWidget.extend({
        template: 'button_list_widget',
        init: function () {
            this._super(arguments[0], {});
            this.show = true;
        },
        start: function () {
            var self = this;
            this._super();
            $('.show_hide_buttons').click(function () {
                var current_screen = self.pos.gui.get_current_screen();
                if (current_screen == 'products') {
                    if (self.pos.show_left_buttons == true || self.pos.show_left_buttons == undefined) {
                        $('.buttons_pane').animate({width: 0}, 'fast');
                        $('.leftpane').animate({left: 0}, 'fast');
                        $('.rightpane').animate({left: 440}, 'fast');
                        $('.fa fa-list').toggleClass('highlight');
                        $('.show_hide_buttons .fa-chevron-left').toggleClass('fa-chevron-left fa-chevron-right');
                        self.pos.show_left_buttons = false;
                    } else {
                        $('.buttons_pane').animate({width: 170}, 'fast');
                        $('.leftpane').animate({left: 170}, 'fast');
                        $('.rightpane').animate({left: 605}, 'fast');
                        $('.show_hide_buttons .fa-chevron-right').toggleClass('fa-chevron-right fa-chevron-left');
                        self.pos.show_left_buttons = true;
                    }
                }
            });
        }
    });
    chrome.Chrome.include({
        build_widgets: function () {
            if (!this.pos.pos_session.mobile_responsive) {
                this.widgets = _.filter(this.widgets, function (widget) {
                    return widget['name'] != 'button_list_widget';
                });
                this.widgets.splice(1, 0, {
                    'name': 'button_list_widget',
                    'widget': button_list_widget,
                    'append': '.pos-branding',
                });
            }
            this._super();
        }
    });

    chrome.OrderSelectorWidget.include({ // TODO: validate delete order
        deleteorder_click_handler: function (event, $el) {
            if (this.pos.config.validate_remove_order) {
                this.pos._validate_by_manager('this.pos.delete_current_order()')
            } else {
                return this._super()
            }
        },
        renderElement: function () {
            this._super();
            if (!this.pos.config.allow_remove_order || this.pos.config.allow_remove_order == false || this.pos.config.is_customer_screen) {
                this.$('.deleteorder-button').replaceWith('');
                this.$('.neworder-button').replaceWith('');
            }
            if (this.pos.config.is_customer_screen) {
                $('.pos .order-selector').css('display', 'none');
                $('.pos-branding').css('display', 'none');
                $('.debug-widget').css('display', 'none');
            }
        }
    });

    chrome.HeaderButtonWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            if (this.action) {
                this.$el.click(function () {
                    if (self.pos.config.close_session) {
                        setTimeout(function () {
                            self.do_action('logout');
                        }, 2000)
                    }
                    if (self.pos.config.validate_close_session) {
                        self.pos._validate_by_manager("self.do_action('logout')");
                    }
                });
            }
        }
    });
});
