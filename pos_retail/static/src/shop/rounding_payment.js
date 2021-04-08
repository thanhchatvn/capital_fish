odoo.define('pos_retail.rounding_payment', function (require) {
    "use strict";

    var screen = require('point_of_sale.screens');

    screen.PaymentScreenWidget.include({
        click_paymentmethods: function (id) {
            this._super(id);
            var selected_order = this.pos.get_order();
            var payment_method_rounding = _.find(this.pos.payment_methods, function (method) {
                return method.pos_method_type == 'rounding';
            });
            if (!selected_order || !this.pos.config.rounding_total_paid || !payment_method_rounding) {
                return;
            }
            var selected_paymentline = selected_order.selected_paymentline;
            var due = selected_order.get_due();
            var after_round = Math.round(due * Math.pow(10, payment_method_rounding.journal.decimal_rounding)) /  Math.pow(10, payment_method_rounding.journal.decimal_rounding);
            var amount_round = after_round - due;
            if (amount_round == 0) {
                return;
            }
            var rounded_paymentline = _.find(selected_order.paymentlines.models, function (payment) {
                return payment.payment_method.journal && payment.payment_method.journal.pos_method_type == 'rounding';
            });
            if (rounded_paymentline) {
                rounded_paymentline.set_amount(-amount_round);
            } else {
                selected_order.add_paymentline(payment_method_rounding);
                var rounded_paymentline = selected_order.selected_paymentline;
                rounded_paymentline.set_amount(-amount_round);
            }
            this.reset_input();
            this.order_changes();
            this.render_paymentlines();
            this.$('.paymentline.selected .edit').text(amount_round.toFixed(3));
        }
    });
});
