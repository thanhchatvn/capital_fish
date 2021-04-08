odoo.define('pos_retail.design', function (require) {
    "use strict";
    var chrome = require('point_of_sale.chrome');

    chrome.Chrome.include({
        build_widgets: function () {
            this._super();
            var self = this;
            if (this.pos.config.design) {
                setTimeout(function () {
                    if (self.pos.config.design_background_color) {
                        $('.pos-content').css({'background': self.pos.config.design_background_color});
                        $('.header_order').css({'background': self.pos.config.design_background_color});
                    }
                    if (self.pos.config.design_header_background_color) {
                        $('.pos-topheader').css({'background': self.pos.config.design_header_background_color});
                    }
                    if (self.pos.config.design_button_color) {
                        $('.left_button').css({'background': self.pos.config.design_header_color});
                    }
                    if (self.pos.config.design_button_color) {
                        $('.left_button').css({'color': self.pos.config.design_header_color});
                        // $('.left_button').css({'background': self.pos.config.design_button_background_color});
                    }
                }, 500)
            }
        }
    });
});
