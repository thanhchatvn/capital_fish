# -*- coding: utf-8 -*
from odoo import http, _
from odoo.addons.web.controllers import main as web
import odoo
from odoo import api, fields, models, SUPERUSER_ID

import json
import logging
from odoo.http import request
import time

_logger = logging.getLogger(__name__)


class SyncController(web.Home):

    @http.route('/pos/create_from_ui', type="json", auth='none', csrf=False, cors='*', methods=['POST'])
    def endpoint_save_orders(self):
        datas = json.loads(request.httprequest.data)
        database = datas.get('database')
        username = datas.get('username')
        server_version = datas.get('server_version')
        orders = datas.get('orders')
        order_ids = []
        if len(orders) > 0:
            registry = odoo.registry(database)
            orders = [order[2] for order in orders]
            with registry.cursor() as cr:
                env = api.Environment(cr, SUPERUSER_ID, {})
                order_ids = env['pos.order'].sudo().create_from_ui(orders)
                _logger.info('User %s created order ids: %s - odoo version %s' % (username, order_ids, server_version))
        return order_ids
