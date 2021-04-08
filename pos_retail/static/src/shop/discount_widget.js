odoo.define('pos_retail.discount_widget', function (require) {
    "use strict";
    var chrome = require('point_of_sale.chrome');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var gui = require('point_of_sale.gui');
    var _t = require('web.core')._t;
    var screen_core = require('pos_retail.screen_core');
    var screens = require('point_of_sale.screens');
    var models = require('point_of_sale.models');

    /* ------------ The Discount Widget ------------ */
    // The numpad that edits the order lines.

    var DiscountWidget = PosBaseWidget.extend({
        template: 'DiscountWidget',
        init: function (parent) {
            this._super(parent);
            this.state = new models.NumpadState();
        },
        start: function () {
            this.applyAccessRights();
            this.state.bind('change:mode', this.changedMode, this);
            this.pos.bind('change:cashier', this.applyAccessRights, this);
            this.changedMode();
            this.$el.find('.numpad-backspace').click(_.bind(this.clickDeleteLastChar, this));
            this.$el.find('.numpad-minus').click(_.bind(this.clickSwitchSign, this));
            this.$el.find('.number-char').click(_.bind(this.clickAppendNewChar, this));
            this.$el.find('.mode-button').click(_.bind(this.clickChangeMode, this));
        },
        applyAccessRights: function () {
            var cashier = this.pos.get('cashier') || this.pos.get_cashier();
            var has_price_control_rights = !this.pos.config.restrict_price_control || cashier.role == 'manager';
            this.$el.find('.mode-button[data-mode="price"]')
                .toggleClass('disabled-mode', !has_price_control_rights)
                .prop('disabled', !has_price_control_rights);
            if (!has_price_control_rights && this.state.get('mode') == 'price') {
                this.state.changeMode('quantity');
            }
        },
        clickDeleteLastChar: function () {
            $('.numpad').removeClass('oe_hidden');
            $('.control-buttons').addClass('oe_hidden');
        },
        clickSwitchSign: function () {
            return this.state.switchSign();
        },
        clickAppendNewChar: function (event) {
            var order = this.pos.get_order();
            var discount_id = parseInt(event.target.getAttribute('id'));
            var discount = _.find(this.pos.discounts, function (disc) {
                return disc.id == discount_id
            });
            if (discount && order && order.selected_orderline) {
                order.selected_orderline.set_global_discount(discount);
            }
            if (discount_id == 0 && order && order.selected_orderline) {
                order.selected_orderline.set_discount(0);
            }

        },
        clickChangeMode: function (event) {
            var newMode = event.currentTarget.attributes['data-mode'].nodeValue;
            return this.state.changeMode(newMode);
        },
        changedMode: function () {
            var mode = this.state.get('mode');
            $('.selected-mode').removeClass('selected-mode');
            $(_.str.sprintf('.mode-button[data-mode="%s"]', mode), this.$el).addClass('selected-mode');
        },
    });

    screens.NumpadWidget.include({
        clickChangeMode: function (event) {
            var newMode = event.currentTarget.attributes['data-mode'].nodeValue;
            var discount_manual = this.pos.config.discount_manual;
            if (this.pos.config.discount && this.pos.config.discount_ids.length && newMode == 'discount') {
                $('.numpad-discount').replaceWith();
                $('.control-buttons').removeClass('oe_hidden');
                this.discounts = new DiscountWidget(this, {
                    widget: this,
                });
                this.discounts.appendTo($('.control-buttons'));
            }
            return this._super(event);
        },
    })
});
