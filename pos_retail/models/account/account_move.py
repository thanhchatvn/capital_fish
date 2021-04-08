# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
import logging

_logger = logging.getLogger(__name__)

class AccountMove(models.Model):

    _inherit = "account.move"

    pos_branch_id = fields.Many2one('pos.branch', string='Branch', readonly=1)

    @api.model
    def create(self, vals):
        if not vals.get('company_id', None):
            vals.update({'company_id': self.env.user.company_id.id})
        move = super(AccountMove, self).create(vals)
        return move

class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    pos_branch_id = fields.Many2one('pos.branch', string='Branch', readonly=1)

    def _prepare_analytic_line(self):
        analytic_line_value = super(AccountMoveLine, self)._prepare_analytic_line()
        if analytic_line_value and analytic_line_value[0] and not analytic_line_value[0].get('name', None):
            analytic_line_value[0]['name'] = self.ref or self.move_id.ref
        return analytic_line_value[0]