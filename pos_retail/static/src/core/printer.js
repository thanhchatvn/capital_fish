odoo.define('pos_retail.printer', function (require) {
    var Printer = require('point_of_sale.Printer');
    var chrome = require('point_of_sale.chrome');
    var core = require('web.core');
    var _t = core._t;
    var screens = require('point_of_sale.screens');
    var qweb = core.qweb;

    Printer.Printer.include({
        print_receipt: function (receipt) {
            if (this.pos.config.posbox_older_version && receipt) {
                return this.print_direct_receipt(receipt)
            }
            this._super(receipt)
        },
        print_direct_receipt: function (receipt) {
            return this.connection.rpc('/hw_proxy/print_xml_receipt', {
                receipt: receipt,
            });
        },
    });

    chrome.ProxyStatusWidget.include({
        set_smart_status: function (status) {
            if (!this.pos.config.posbox_older_version) {
                return this._super(status)
            } else {
                if (status.status === 'connected') {
                    var warning = false;
                    var msg = '';
                    if (this.pos.config.iface_scan_via_proxy) {
                        var scanner = status.drivers.scanner ? status.drivers.scanner.status : false;
                        if (scanner != 'connected' && scanner != 'connecting') {
                            warning = true;
                            msg += _t('Scanner');
                        }
                    }
                    if (this.pos.config.iface_print_via_proxy || this.pos.config.iface_cashdrawer) {
                        var printer = status.drivers.printer ? status.drivers.printer.status : false;
                        if (!printer) {
                            printer = status.drivers.escpos ? status.drivers.escpos.status : false;
                        }
                        if (printer != 'connected' && printer != 'connecting') {
                            warning = true;
                            msg = msg ? msg + ' & ' : msg;
                            msg += _t('Printer');
                        }
                    }
                    if (this.pos.config.iface_electronic_scale) {
                        var scale = status.drivers.scale ? status.drivers.scale.status : false;
                        if (scale != 'connected' && scale != 'connecting') {
                            warning = true;
                            msg = msg ? msg + ' & ' : msg;
                            msg += _t('Scale');
                        }
                    }

                    msg = msg ? msg + ' ' + _t('Offline') : msg;
                    this.set_status(warning ? 'warning' : 'connected', msg);
                } else {
                    this.set_status(status.status, status.msg || '');
                }
            }
        },
    });

    screens.ReceiptScreenWidget.include({
        print_html: function () {
            if (this.pos.config.posbox_older_version) {
                var receipt = qweb.render('XmlReceipt', this.get_receipt_render_env());
                this.pos.proxy.printer.print_receipt(receipt);
                this.pos.get_order()._printed = true;
            } else {
                this._super();
            }
        },
    });
})
;
