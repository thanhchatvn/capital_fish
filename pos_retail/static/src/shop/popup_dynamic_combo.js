"use strict";
odoo.define('pos_retail.popup_dynamic_combo', function (require) {

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var qweb = core.qweb;
    var PopupWidget = require('point_of_sale.popups');


    var popup_dynamic_combo = PopupWidget.extend({ // select combo
        template: 'popup_dynamic_combo',
        get_product_image_url: function (product) {
            return window.location.origin + '/web/image?model=product.product&field=image_128&id=' + product.id;
        },
        show: function (options) {
            this.limit = 100;
            this.options = options;
            this.selected_combo_items = options.selected_combo_items || {};
            this._super(options);
            var pos_categories_combo = _.filter(this.pos.pos_categories, function (categ) {
                return categ.is_category_combo
            });
            this.$el.find('input').focus();
            this.$el.find('.table-striped-1>tbody').html(qweb.render('dynamic_categories_combo', {
                pos_categories: pos_categories_combo,
                widget: this
            }));
            this._add_event_click_line();
            this._click_category();
        },
        _click_minus_plus: function() {
            var self = this;
            this.$('.minus').click(function () {
                var product_id = parseInt($(this).parent().data('productId'));
                if (self.selected_combo_items[product_id] == undefined) {
                    self.selected_combo_items[product_id] = 0;
                } else {
                    if (self.selected_combo_items[product_id] > 0) {
                        self.selected_combo_items[product_id] -= 1
                    }
                }
                if (self.selected_combo_items[product_id] || self.selected_combo_items[product_id] == 0) {
                    $(this).parent().find('.combo-item-cart_qty').html(self.selected_combo_items[product_id])
                }
            });
            this.$('.plus').click(function () {
                var product_id = parseInt($(this).parent().data('productId'));
                if (!self.selected_combo_items[product_id]) {
                    self.selected_combo_items[product_id] = 1;
                } else {
                    self.selected_combo_items[product_id] += 1
                }
                $(this).parent().find('.combo-item-cart_qty').html(self.selected_combo_items[product_id])
            });
        },
        _click_category: function () {
            var self = this;
            this.$('.popup_category_item').click(function () {
                var category_id = parseInt($(this).data('categoryId'));
                var products_by_category = self.pos.db.get_product_by_category(category_id);
                var products_is_combo_item = _.filter(products_by_category, function (product) {
                    return product.is_combo_item;
                });
                var products = [];
                for (var n=0; n < products_is_combo_item.length; n++) {
                    var product_exist = _.find(products, function (p) {
                        return p.id == products_is_combo_item[n].id
                    })
                    if (!product_exist) {
                        products.push(products_is_combo_item[n])
                    }
                }
                if (products.length) {
                    for (var i=0; i < products.length; i++) {
                        var product = products[i];
                        if (self.selected_combo_items[product.id]) {
                            product.quantity = self.selected_combo_items[product.id];
                        } else {
                            product.quantity = 0
                        }
                    }
                    self.$el.find('.table-striped-2>tbody').html(qweb.render('dynamic_combo_items', {
                        products: products,
                        widget: self
                    }));
                    self.category_selected_id = category_id;
                    self._click_minus_plus();
                } else {
                    self.$el.find('.table-striped-2>tbody').html(qweb.render('dynamic_combo_items_not_found', {
                        widget: self
                    }));
                }
            });
        },
        _add_event_click_line: function () {
            var self = this;
            this.$('.add_quantity').click(function () {
                var selected_id = parseInt($(this).data('id'));
                var data_selected = _.find(self.sub_datas, function (sub_data) {
                    return sub_data.id == selected_id
                });
                if (data_selected) {
                    data_selected['quantity'] += 1;
                    $(this).html(data_selected['quantity'])
                }
                self.passed_input('tr[data-id="' + selected_id + '"]');
            });
            this.$('.remove_quantity').click(function () {
                var selected_id = parseInt($(this).data('id'));
                var data_selected = _.find(self.sub_datas, function (sub_data) {
                    return sub_data.id == selected_id
                });
                if (data_selected) {
                    if (data_selected['quantity'] > 0) {
                        data_selected['quantity'] -= 1;
                        $(this).parent().find('.add_quantity').html(data_selected['quantity'])
                        self.passed_input('tr[data-id="' + selected_id + '"]');
                    } else {
                        self.wrong_input('tr[data-id="' + selected_id + '"]', "(*) Quantity required bigger than or equal 0");
                    }
                }
            });
        },
        click_confirm: function () {
            if (this.options.confirm) {
                var values = {};
                for (var product_id in this.selected_combo_items) {
                    if (this.selected_combo_items[product_id] > 0) {
                        values[product_id] = this.selected_combo_items[product_id]
                    }
                }
                this.options.confirm.call(this, values);
                this.pos.gui.close_popup();
            }
        },
    });
    gui.define_popup({name: 'popup_dynamic_combo', widget: popup_dynamic_combo});
});
