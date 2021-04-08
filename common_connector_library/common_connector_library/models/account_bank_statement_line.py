from odoo import models, fields

class AccountBankStatementLine(models.Model):
    _inherit = "account.bank.statement.line"

    sale_order_id = fields.Many2one('sale.order', string="Sale Order")
    is_refund_line = fields.Boolean("Is Refund Line ?", default=False, copy=False)
    refund_invoice_id = fields.Many2one('account.move','invoice_id')
    is_ending_balance_entry = fields.Boolean("Is Ending Balance Entry?", default=False, copy=False)
