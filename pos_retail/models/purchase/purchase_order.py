from odoo import api, models, fields
import odoo
import logging

_logger = logging.getLogger(__name__)

class purchase_order(models.Model):
    _inherit = "purchase.order"

    signature = fields.Binary('Signature', readonly=1)
    journal_id = fields.Many2one('account.journal', 'Vendor bill Journal')

    @api.model
    def create_po(self, vals, purchase_order_state):
        _logger.info(vals)
        version_info = odoo.release.version_info[0]
        po = self.create(vals)
        for line in po.order_line:
            line._onchange_quantity()
        po.button_confirm()
        if purchase_order_state in ['confirm_picking']:
            for picking in po.picking_ids:
                if version_info == 10:
                    transfer = self.env['stock.immediate.transfer'].create({'pick_id': picking.id})
                    transfer.process()
                if version_info in [11, 12]:
                    for move_line in picking.move_line_ids:
                        move_line.write({'qty_done': move_line.product_uom_qty})
                    for move_line in picking.move_lines:
                        move_line.write({'quantity_done': move_line.product_uom_qty})
                    picking.button_validate()
        return {
            'name': po.name,
            'id': po.id
        }
