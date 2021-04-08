# -*- coding: utf-8 -*
from odoo.http import request
from odoo.addons.bus.controllers.main import BusController
from odoo.addons.point_of_sale.controllers.main import PosController
import json
import werkzeug.utils
from odoo import http, _
from odoo.addons.web.controllers.main import ensure_db, Home, Session, WebClient
from datetime import datetime
import odoo
from odoo.osv.expression import AND

version_info = odoo.release.version_info[0]

datetime.strptime('2012-01-01', '%Y-%m-%d')

import logging

_logger = logging.getLogger(__name__)


class pos_controller(PosController):

    @http.route('/pos/web', type='http', auth='user')
    def pos_web(self, config_id=False, **k):
        """Open a pos session for the given config.

        The right pos session will be selected to open, if non is open yet a new session will be created.

        :param debug: The debug mode to load the session in.
        :type debug: str.
        :param config_id: id of the config that has to be loaded.
        :type config_id: str.
        :returns: object -- The rendered pos session.
        """
        domain = [
            ('state', '=', 'opened'),
            ('user_id', '=', request.session.uid),
            ('rescue', '=', False)
        ]
        if config_id:
            domain = AND([domain, [('config_id', '=', int(config_id))]])
        pos_session = request.env['pos.session'].sudo().search(domain, limit=1)
        if not pos_session or not config_id:
            return werkzeug.utils.redirect('/web#action=point_of_sale.action_client_pos_menu')
        # The POS only work in one company, so we enforce the one of the session in the context
        session_info = request.env['ir.http'].session_info()
        session_info['model_ids'] = {
            'product.product': {
                'min_id': 0,
                'max_id': 0,
            },
            'res.partner': {
                'min_id': 0,
                'max_id': 0
            },
        }
        request.env.cr.execute("select max(id) from product_product")
        product_max_ids = request.env.cr.fetchall()
        request.env.cr.execute("select count(id) from product_product")
        count_products = request.env.cr.fetchall()
        session_info['model_ids']['product.product']['max_id'] = product_max_ids[0][0] if len(product_max_ids) == 1 else 1
        session_info['model_ids']['product.product']['count'] = count_products[0][0] if len(count_products) == 1 else None
        request.env.cr.execute("select max(id) from res_partner")
        partner_max_ids = request.env.cr.fetchall()
        session_info['model_ids']['res.partner']['max_id'] = partner_max_ids[0][0] if len(partner_max_ids) == 1 else 10
        request.env.cr.execute("select count(id) from res_partner")
        count_partners = request.env.cr.fetchall()
        session_info['model_ids']['res.partner']['count'] = count_partners[0][0] if len(count_partners) == 1 else None
        session_info['user_context']['allowed_company_ids'] = pos_session.company_id.ids
        session_info['company_currency_id'] = request.env.user.company_id.currency_id.id
        session_info['big_datas_turbo'] = pos_session.config_id.big_datas_turbo
        if session_info['big_datas_turbo']:
            cached = request.env['pos.cache.config'].search([
                ('config_id', '=', pos_session.config_id.id)
            ], limit=1)
            if cached:
                session_info['json_datas'] = json.loads(cached.json_datas)
        context = {
            'session_info': session_info,
            'login_number': pos_session.login(),
        }
        return request.render('point_of_sale.index', qcontext=context)


class web_login(Home):  # auto go directly POS when login

    def iot_login(self, db, login, password):
        try:
            request.session.authenticate(db, login, password)
            request.params['login_success'] = True
            return http.local_redirect('/pos/web/')
        except:
            return False

    @http.route()
    def web_login(self, *args, **kw):
        ensure_db()
        response = super(web_login, self).web_login(*args, **kw)
        if request.httprequest.method == 'GET' and kw.get('database', None) and kw.get('login', None) and kw.get(
                'password', None) and kw.get('iot_pos', None):
            return self.iot_login(kw.get('database', None), kw.get('login', None), kw.get('password', None))
        if request.session.uid:
            user = request.env['res.users'].browse(request.session.uid)
            pos_config = user.pos_config_id
            if pos_config:
                return http.local_redirect('/pos/web?config_id=%s' % pos_config.id)
        return response


class pos_bus(BusController):

    def _poll(self, dbname, channels, last, options):
        channels = list(channels)
        if request.env.user:
            channels.append((request.db, 'pos.test.polling', request.env.user.id))
            channels.append((request.db, 'pos.sync.pricelists', request.env.user.id))
            channels.append((request.db, 'pos.sync.promotions', request.env.user.id))
            channels.append((request.db, 'pos.remote_sessions', request.env.user.id))
            channels.append((request.db, 'pos.sync.sessions', request.env.user.id))
            channels.append((request.db, 'pos.sync.backend', request.env.user.id))
            channels.append((request.db, 'pos.sync.stock', request.env.user.id))
        return super(pos_bus, self)._poll(dbname, channels, last, options)

    @http.route('/pos/update_order/status', type="json", auth="public")
    def bus_update_sale_order(self, status, order_name):
        sales = request.env["sale.order"].sudo().search([('name', '=', order_name)])
        sales.write({'sync_status': status})
        return 1

    @http.route('/pos/test/polling', type="json", auth="public")
    def test_polling(self, pos_id, messages):
        _logger.info('test_polling POS ID: %s' % pos_id)
        request.env['bus.bus'].sendmany(
            [[(request.env.cr.dbname, 'pos.test.polling', 1), messages]])
        return 1

