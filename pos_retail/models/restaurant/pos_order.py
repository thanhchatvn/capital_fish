# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from itertools import groupby

from odoo import api, fields, models

import logging

_logger = logging.getLogger(__name__)

class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    note = fields.Char('Note added by the waiter.')
    mp_skip = fields.Boolean('Skip line when sending ticket to kitchen printers.')


class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def get_table_draft_orders(self, table_id):
        table_orders = super(PosOrder, self).get_table_draft_orders(table_id)
        is_active_sync = False
        if len(table_orders):
            server = self.browse(table_orders[0].get('server_id'))
            self.env.cr.execute("SELECT sync_multi_session FROM pos_config WHERE id=%s" % server.config_id.id)
            datas = self._cr.fetchall()
            if len(datas) == 1 and datas[0][0]:
                is_active_sync = True
        if is_active_sync:
            return []
        else:
            return table_orders

