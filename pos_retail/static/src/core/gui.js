odoo.define('pos_retail.gui', function (require) {
    "use strict";
    var gui = require('point_of_sale.gui');

    gui.Gui.include({
        show_popup: function (name, options) {
            if (!this.popup_instances[name]) {
                console.error('PopUp name ' + name + ' not found');
                return null;
            }
            if (!this.pos.config.is_customer_screen) {
                return this._super(name, options);
            } else {
                return null;
            }
            this.remove_keyboard()
        },
        add_keyboard: function (screen_name) {
            var products_screen = this.screen_instances['products'];
            if (!products_screen) {
                return false;
            } else {
                var order_widget = products_screen.order_widget;
                if (!order_widget) {
                    console.error('could not find order widget');
                    return false
                }
                if (screen_name == 'products') {
                    order_widget.add_event_keyboard();
                    order_widget.event_input_linked_keyboard_event();
                } else {
                    order_widget.remove_event_keyboard();
                }
            }
        },
        remove_keyboard: function () {
            var products_screen = this.screen_instances['products'];
            if (!products_screen) {
                return res;
            } else {
                var order_widget = products_screen.order_widget;
                if (!order_widget) {
                    console.error('could not find order widget');
                } else {
                    order_widget.remove_event_keyboard();
                }
            }
        },
        show_screen: function (screen_name, params, refresh, skip_close_popup) {
            if (screen_name != 'products' || this.pos.pos_session.mobile_responsive) {
                $('.pos-branding').addClass('oe_hidden');
                $('.pos .pos-rightheader').css('left', '0px');
            } else {
                $('.pos-branding').removeClass('oe_hidden');
                $('.pos .pos-rightheader').css('left', '610px');
            }
            this._super(screen_name, params, refresh, skip_close_popup);
            if (!this.pos.pos_session.mobile_responsive) {
                this.add_keyboard(screen_name);
            }
        },
        close_popup: function () {
            this._super();
            if (!this.pos.pos_session.mobile_responsive) {
                this.add_keyboard(this.get_current_screen());
            }
        },
        set_default_screen: function (name) {
            var res = this._super(name);
            if (!this.pos.pos_session.mobile_responsive) {
                var products_screen = this.screen_instances['products'];
                if (!products_screen) {
                    return res;
                } else {
                    var order_widget = products_screen.order_widget;
                    if (!order_widget) {
                        return res;
                    }
                    order_widget.event_input_linked_keyboard_event();
                }
            }

        },
    });
});