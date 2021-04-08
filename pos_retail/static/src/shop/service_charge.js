odoo.define('pos_retail.service_charge', function (require) {
    "use strict";
    var chrome = require('point_of_sale.chrome');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var gui = require('point_of_sale.gui');
    var _t = require('web.core')._t;
    var screen_core = require('pos_retail.screen_core');
    var screens = require('point_of_sale.screens');
    var models = require('point_of_sale.models');

    models.load_models([
        {
            model: 'pos.service.charge',
            fields: ['name', 'product_id', 'type', 'amount'],
            condition: function (self) {
                return self.config.service_charge_ids && self.config.service_charge_ids.length;
            },
            domain: function (self) {
                return [
                    ['id', 'in', self.config.service_charge_ids],
                ]
            },
            loaded: function (self, services_charge) {
                self.services_charge = services_charge;
                self.services_charge_ids = [];
                self.service_charge_by_id = {};
                for (var i = 0; i < services_charge.length; i++) {
                    var service = services_charge[i];
                    self.services_charge_ids.push(service.id);
                    self.service_charge_by_id[service.id] = service;
                }
            }
        },
    ], {
        after: 'pos.config'
    });

    /* ------------ The Service Charge Widget ------------ */
    // The numpad that edits the order lines.

    var ServiceChargeWidget = PosBaseWidget.extend({
        template: 'ServiceChargeWidget',
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
            var service_id = parseInt(event.target.getAttribute('id'));
            var service = this.pos.service_charge_by_id[service_id];
            var product = this.pos.db.get_product_by_id(service['product_id'][0])
            if (product) {
                if (service['type'] == 'fixed') {
                    order.add_product(product, {
                        price: service.amount,
                        quantity: 1,
                        merge: false,
                        extras: {
                            service_id: service.id,
                        }
                    });
                } else {
                    var amount_total = order.get_total_with_tax();
                    var amount_tax = order.get_total_tax();
                    var sub_amount = amount_total - amount_tax;
                    var price = sub_amount - ( sub_amount * service.amount / 100)
                    order.add_product(product, {
                        price: price,
                        quantity: 1,
                        merge: false,
                        extras: {
                            service_id: service.id,
                        }
                    });
                }
            } else {
                this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Could not found Product: ' + service['product_id'][1] + ' available in pos')
                })
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
            if (this.pos.config.discount && this.pos.config.discount_ids.length && newMode == 'service') {
                $('.numpad-discount').replaceWith();
                $('.control-buttons').removeClass('oe_hidden');
                this.services_charge = new ServiceChargeWidget(this, {
                    widget: this,
                });
                this.services_charge.appendTo($('.control-buttons'));
            }
            return this._super(event);
        },
    })
});
