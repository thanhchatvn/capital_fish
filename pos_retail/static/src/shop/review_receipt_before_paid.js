odoo.define('pos_retail.screen_single', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var qweb = core.qweb;

    screens.ScreenWidget.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('change:selectedOrder', function () {
                self.show_ticket();
            }, this);
            this.pos.bind('change:currency', function () {
                self.show_ticket();
            }, this);
        },
        show: function () {
            this._super();
            this.show_ticket();
        },
        hide: function () {
            this._super();
            this.show_ticket();
        },
        renderElement: function () {
            this._super();
            this.show_ticket();
        },
        render_tempalte_receipt: function () {
            this.$('.pos-sale-ticket').replaceWith('');
            this.$('.pos-receipt').replaceWith();
            var receipt = qweb.render('OrderReceipt', this.pos.gui.screen_instances['receipt'].get_receipt_render_env());
            this.$('.screen-content').append(receipt);
            if (this.pos.config.ticket_font_size) {
                this.$('.pos-receipt').css({'font-size': this.pos.config.ticket_font_size})
            }
        },
        show_ticket: function () {
            var cur_screen = this.pos.gui.get_current_screen();
            if (!cur_screen || this.pos.pos_session.mobile_responsive || !this.pos.config.review_receipt_before_paid) {
                return;
            }
            if (cur_screen == 'payment' || cur_screen == 'clientlist') {
                this.$('.pos-sale-ticket').replaceWith('');
                this.$('.screen-content').css({
                    'width': '100%',
                    'max-width': '100%'
                });
                this.$('.top-content').css({
                    'left': '32%'
                });
                this.render_tempalte_receipt();
                this.$('.full-content').css({
                    'left': '32%'
                })
            }
        }
    });
});
