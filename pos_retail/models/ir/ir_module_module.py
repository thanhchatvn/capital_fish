# -*- coding: utf-8 -*-
from odoo import api, models, fields

class IrModuleModule(models.Model):
    _inherit = "ir.module.module"

    def button_immediate_upgrade(self):
        res = super(IrModuleModule, self).button_immediate_upgrade()
        self.env['pos.call.log'].sudo().search([]).unlink()
        self.env['pos.cache.config'].sudo().search([]).unlink()
        return res
