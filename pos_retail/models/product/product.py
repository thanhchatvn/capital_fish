# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
import logging
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class pos_sale_extra(models.Model):
    _name = "pos.sale.extra"
    _description = "Sale extra items base on core product"

    product_tmpl_id = fields.Many2one('product.template', 'Base Product', required=1,
                                      domain=[('available_in_pos', '=', True)])
    product_id = fields.Many2one('product.product', 'Product extra', required=1,
                                 domain=[('available_in_pos', '=', True)])
    quantity = fields.Float('Default Qty', default=1, required=1)
    list_price = fields.Float('List Price', required=1)

    @api.model
    @api.onchange('product_id')
    def onchange_product_id(self):
        self.list_price = self.product_id.list_price


class product_template(models.Model):
    _inherit = 'product.template'

    pos_combo_item_ids = fields.One2many('pos.combo.item', 'product_combo_id', string='Combo Items')
    is_combo = fields.Boolean('Is Combo/Package')
    is_combo_item = fields.Boolean('Is Combo Item')
    combo_limit = fields.Integer(
        'Combo Item Limit',
        help='Limit combo items can allow cashier add / combo')
    is_credit = fields.Boolean('Is Credit', default=False)
    multi_category = fields.Boolean('Multi Category')
    pos_categ_ids = fields.Many2many(
        'pos.category',
        string='POS Multi Category')
    multi_uom = fields.Boolean('Multi Unit')
    price_uom_ids = fields.One2many(
        'product.uom.price',
        'product_tmpl_id',
        string='Price by Sale Unit')
    multi_variant = fields.Boolean('Product Multi variant')
    pos_variant_ids = fields.One2many(
        'product.variant',
        'product_tmpl_id',
        string='Multi Variants')
    cross_selling = fields.Boolean('Cross Selling')
    cross_ids = fields.One2many(
        'product.cross',
        'product_tmpl_id',
        string='Cross Selling Items')
    supplier_barcode = fields.Char(
        'Supplier Barcode', copy=False,
        help="Supplier Barcode Product, You can Input here and scan on POS")
    barcode_ids = fields.One2many(
        'product.barcode',
        'product_tmpl_id',
        string='Multi Barcode')
    pack_ids = fields.One2many(
        'product.quantity.pack',
        'product_tmpl_id',
        string='Quantities Pack')
    pos_sequence = fields.Integer('POS Sequence')
    is_voucher = fields.Boolean('Is Voucher', default=0)
    sale_extra = fields.Boolean(string='Active Sale Extra')
    sale_extra_item_ids = fields.One2many(
        'pos.sale.extra',
        'product_tmpl_id',
        'Sale Extra Items')
    minimum_list_price = fields.Float('Min Sales Price', default=0)
    sale_with_package = fields.Boolean('Sale with Package')
    price_unit_each_qty = fields.Boolean('Active Sale Price each Quantity')
    product_price_quantity_ids = fields.One2many(
        'product.price.quantity',
        'product_tmpl_id',
        'Price each Quantity')
    qty_warning_out_stock = fields.Float('Qty Warning out of Stock', default=10)
    pos_combo_categ_id = fields.Many2one('pos.category', 'Combo Category')
    combo_price = fields.Float('Combo price')
    name_second = fields.Char(
        'Second Name',
        help='If you need print pos receipt Arabic,Chinese...language\n'
             'Input your language here, and go to pos active Second Language')

    def write(self, vals):
        res = super(product_template, self).write(vals)
        for product_temp in self:
            products = self.env['product.product'].search([('product_tmpl_id', '=', product_temp.id)])
            for product in products:
                if product.sale_ok and product.available_in_pos:
                    self.env['pos.cache.database'].insert_data('product.product', product.id)
                if not product.available_in_pos or not product.active:
                    self.env['pos.cache.database'].remove_record('product.product', product.id)
        return res

    def unlink(self):
        for product_temp in self:
            products = self.env['product.product'].search([('product_tmpl_id', '=', product_temp.id)])
            for product in products:
                self.env['pos.cache.database'].remove_record('product.product', product.id)
        return super(product_template, self).unlink()


class product_product(models.Model):
    _inherit = 'product.product'

    def write(self, vals):
        res = super(product_product, self).write(vals)
        for product in self:
            if product.available_in_pos and product.active:
                self.env['pos.cache.database'].insert_data('product.product', product.id)
            if not product.available_in_pos or not product.active:
                self.env['pos.cache.database'].remove_record(self._inherit, product.id)
        return res

    @api.model
    def create(self, vals):
        product = super(product_product, self).create(vals)
        if product.sale_ok and product.available_in_pos:
            self.env['pos.cache.database'].insert_data(self._inherit, product.id)
        return product

    def unlink(self):
        for product in self:
            self.env['pos.cache.database'].remove_record(self._inherit, product.id)
        return super(product_product, self).unlink()
