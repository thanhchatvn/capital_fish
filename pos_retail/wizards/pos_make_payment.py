# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import float_is_zero


class PosMakePayment(models.TransientModel):
    _inherit = 'pos.make.payment'

    def add_payment(self, data):
        self.env['pos.payment'].create(data)
        order = self.env['pos.order'].browse(data['pos_order_id'])
        order.amount_paid = sum(order.payment_ids.mapped('amount'))