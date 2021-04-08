"use strict";
odoo.define('pos_retail.devices', function (require) {

    // **********************************************
    // **********************************************
    // **********************************************
    // **********************************************
    // Supported >= 2 millions datas products
    // **********************************************
    // **********************************************
    // **********************************************
    // **********************************************

    var devices = require('point_of_sale.devices');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var models = require('point_of_sale.models');
    var indexed_db = require('pos_retail.indexedDB');
    //
    // var _super_BarcodeReader = devices.BarcodeReader.prototype;
    // devices.BarcodeReader = devices.BarcodeReader.extend({
    //     scan: function (code) {
    //         var self = this;
    //         self.code = code;
    //         var index_list = ['bc_index', 'dc_index', 'name_index']
    //         var max_sequence = this.pos.session.model_ids['product.product']['max_id'] / 100000 + 1;
    //         $.when(indexed_db.search_by_index('product.product', max_sequence, index_list, code)).done(function (product) {
    //             if (product['id']) {
    //                 var product_is_product_exist = self.pos.db.product_by_id[product['id']];
    //                 if (!product_is_product_exist) {
    //                     if (self.pos.server_version == 10) {
    //                         self.pos.db.add_products([product]);
    //                     }
    //                     if (self.pos.server_version == 11 || self.pos.server_version == 12) {
    //                         var using_company_currency = self.pos.config.currency_id[0] === self.pos.company.currency_id[0];
    //                         var conversion_rate = self.pos.currency.rate / self.pos.company_currency.rate;
    //                         self.pos.db.add_products(_.map([product], function (product) {
    //                             if (!using_company_currency) {
    //                                 product.lst_price = round_pr(product.lst_price * conversion_rate, self.pos.currency.rounding);
    //                             }
    //                             product.categ = _.findWhere(self.pos.product_categories, {'id': product.categ_id[0]});
    //                             return new models.Product({}, product);
    //                         }));
    //                     }
    //                 }
    //             }
    //         }).catch(function (error) {
    //             return _super_BarcodeReader.scan.call(self, self.code);
    //         }).done(function () {
    //             return _super_BarcodeReader.scan.call(self, self.code);
    //         })
    //     },
    // });
    var _super_ProxyDevice = devices.ProxyDevice.prototype;
    devices.ProxyDevice = devices.ProxyDevice.extend({
        try_hard_to_connect: function (url, options) {
            if (this.pos.config.posbox_older_version) {
                options = options || {};
                var protocol = 'http:';
                var port = (!options.port && protocol == "https:") ? ':443' : ':' + (options.port || '8069');
                this.set_connection_status('connecting');
                if (url.indexOf('//') < 0) {
                    url = protocol + '//' + url;
                }
                if (url.indexOf(':', 5) < 0) {
                    url = url + port;
                }
                function try_real_hard_to_connect(url, retries, done) {
                    done = done || new $.Deferred();
                    $.ajax({
                        url: url + '/hw_proxy/hello',
                        method: 'GET',
                        timeout: 1000,
                    })
                        .done(function () {
                            done.resolve(url);
                        })
                        .fail(function (resp) {
                            if (retries > 0) {
                                try_real_hard_to_connect(url, retries - 1, done);
                            } else {
                                done.reject(resp.statusText, url);
                            }
                        });
                    return done;
                }
                return try_real_hard_to_connect(url, 3);
            } else {
                return _super_ProxyDevice.try_hard_to_connect.call(this, url, options);
            }
        },
    })

});
