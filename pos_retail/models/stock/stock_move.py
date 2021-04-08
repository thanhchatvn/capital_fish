# -*- coding: utf-8 -*-
from odoo import fields, api, models

import logging
import base64
import json

_logger = logging.getLogger(__name__)


class StockMove(models.Model):
    _inherit = "stock.move"

    combo_item_id = fields.Many2one('pos.combo.item', 'Combo Item')
    pos_branch_id = fields.Many2one('pos.branch', string='Branch', readonly=1)

    @api.model
    def create(self, vals):
        Picking = self.env['stock.picking'].sudo()
        if vals.get('picking_id', None):
            picking = Picking.browse(vals.get('picking_id'))
            if picking.pos_branch_id:
                vals.update({'pos_branch_id': picking.pos_branch_id.id})
        move = super(StockMove, self).create(vals)
        return move

class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    pos_branch_id = fields.Many2one('pos.branch', string='Branch', readonly=1)

    @api.model
    def create(self, vals):
        if vals.get('picking_id', None):
            picking = self.env['stock.picking'].browse(vals.get('picking_id'))
            if picking.pos_order_id and picking.pos_order_id.location_id:
                vals.update({'location_id': picking.pos_order_id.location_id.id})
            if picking.pos_branch_id:
                vals.update({'pos_branch_id': picking.pos_branch_id.id})
        MoveLine = super(StockMoveLine, self).create(vals)
        return MoveLine

