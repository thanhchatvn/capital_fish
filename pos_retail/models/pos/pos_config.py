# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
import logging
from odoo.exceptions import UserError
import odoo

version_info = odoo.release.version_info[0]

try:
    to_unicode = unicode
except NameError:
    to_unicode = str

_logger = logging.getLogger(__name__)


class pos_config_image(models.Model):
    _name = "pos.config.image"
    _description = "Image show to customer screen"

    name = fields.Char('Title', required=1)
    image = fields.Binary('Image', required=1)
    config_id = fields.Many2one('pos.config', 'POS config', required=1)
    description = fields.Text('Description')


class pos_config(models.Model):
    _inherit = "pos.config"

    def init(self):
        self.env.cr.execute(
            """DELETE FROM ir_model_data WHERE model IN ('pos.bus', 'pos.bus.log', 'pos.tracking.client')""");

    def set_pricelists_to_pos_sessions_online_without_reload(self):
        for config in self:
            if config.pricelist_id:
                config.pricelist_id.sync_pricelists_all_pos_online()
                break
            else:
                raise UserError('Please active pricelist and set pricelist default')
        return True

    floor_ids = fields.Many2many(
        'restaurant.floor',
        'pos_config_restaurant_floor_rel',
        'pos_config_id',
        'floor_id',
        string="Floors")
    user_id = fields.Many2one('res.users', 'Assigned to')
    config_access_right = fields.Boolean('Config Access Right', default=1)
    allow_discount = fields.Boolean('Allow Change Discount', default=1)
    allow_qty = fields.Boolean('Allow Change Quantity', default=1)
    allow_price = fields.Boolean('Allow Change Price', default=1)
    allow_remove_line = fields.Boolean('Allow Remove Line', default=1)
    allow_numpad = fields.Boolean('Allow Use Numpad', default=1)
    allow_payment = fields.Boolean('Allow Payment', default=1)
    allow_customer = fields.Boolean('Allow set Customer', default=1)
    allow_add_order = fields.Boolean('Allow Add Order', default=1)
    allow_remove_order = fields.Boolean('Allow Remove Order', default=1)
    allow_add_product = fields.Boolean('Allow Add Product', default=1)

    allow_lock_screen = fields.Boolean(
        'Lock Screen when Session Start',
        default=0,
        help='When pos sessions start, \n'
             'cashiers required open POS via pos pass pin (Setting/Users)')
    display_point_receipt = fields.Boolean(
        'Display Point / Receipt', help='Active this field for display loyalty\n'
                                        ' point plus on bill receipt')
    loyalty_id = fields.Many2one(
        'pos.loyalty', 'Loyalty',
        domain=[('state', '=', 'running')])

    promotion_manual_select = fields.Boolean(
        'Promotion manual Choice', default=0,
        help='When you check to this checkbox, \n'
             'your cashiers will have one button, \n'
             'when cashiers clicked on it, \n'
             'all promotions active will display for choose')
    promotion_auto_add = fields.Boolean(
        'Promotion auto Apply',
        help='When you check it,\n'
             'when your cashiers click payment button,\n'
             'all promotions active auto add to order cart')

    create_purchase_order = fields.Boolean('Create PO', default=0)
    create_purchase_order_required_signature = fields.Boolean(
        'PO Required Signature', default=0)
    purchase_order_state = fields.Selection([
        ('confirm_order', 'Auto Confirm'),
        ('confirm_picking', 'Auto Delivery'),
    ], 'Purchaser Order Auto',
        help='This is state of purchase order will process to',
        default='confirm_order')
    sale_order = fields.Boolean('Create Sale Order', default=0)
    sale_order_auto_confirm = fields.Boolean('Auto Confirm', default=0)
    sale_order_auto_invoice = fields.Boolean('Auto Paid', default=0)
    sale_order_auto_delivery = fields.Boolean('Auto Delivery', default=0)
    sale_order_print_receipt = fields.Boolean(
        'Print Receipt',
        help='Allow print receipt when create quotation/order')
    sale_order_required_signature = fields.Boolean(
        'SO Required Signature',
        help='Allow print receipt when create quotation/order')

    pos_orders_management = fields.Boolean(
        'POS Order Management',
        default=0)
    pos_orders_load_all = fields.Boolean(
        'Load all Orders',
        help='If checked: each pos session will load all orders of system to POS Session \n'
             'If uncheck: each pos session will load only orders created from self Config Session')
    pos_orders_filter_by_branch = fields.Boolean(
        'POS Order Filter Branch', default=0,
        help='If you checked it, \n'
             'pos session could not see orders of another branch')
    pos_order_period_return_days = fields.Float(
        'Return Period Days',
        help='This is period days allow customer \n'
             'can return Order or one part of Order',
        default=30)
    hide_buttons_order_return = fields.Boolean(
        'Hide Buttons if Order Return',
        default=0,
        help='Hide All Buttons when Order is return mode')
    display_return_days_receipt = fields.Boolean('Display Return Days on Receipt', default=0)
    display_onhand = fields.Boolean(
        'Show Stock on Hand each Product', default=1,
        help='Display quantity on hand all products on pos screen')
    allow_order_out_of_stock = fields.Boolean(
        'Allow Sale when Product Out Of Stock',
        default=1)
    print_voucher = fields.Boolean(
        'Create/Print voucher',
        help='Allow cashiers create voucher on POS',
        default=0)
    expired_days_voucher = fields.Integer(
        'Expired days of Voucher',
        default=30,
        help='Total days keep voucher can use, \n'
             'if out of period days from create date, voucher will expired')
    sync_multi_session = fields.Boolean('Sync between Sessions', default=0)
    sync_to_pos_config_ids = fields.Many2many(
        'pos.config',
        'sync_session_rel',
        'from_id',
        'to_id',
        string='Sync with POS Configs',
        domain="['|', ('pos_branch_id', '=', pos_branch_id), ('pos_branch_id', '=', None)]",
        help='Any events changes from this pos config will sync direct \n' \
             'to this pos configs selected here'
    )
    sync_manual_button = fields.Boolean(
        'Sync Manual Button',
        help='If active, pos session will have button Sync Selected \n'
             'When click it, order selected will sync another pos configs added above\n'
             'Order selected will replace another order of another session the same uid')
    sync_multi_session_offline = fields.Boolean('Sync Between Session Offline', default=0)
    sync_multi_session_offline_iot_ids = fields.Many2many('pos.iot', 'pos_config_iot_rel', 'pos_config_id',
                                                          'iot_box_id', string='IoT Boxes',
                                                          help='IoT box use for sync between sessions \n'
                                                               'when Odoo Server Offline or your internet disconected')
    display_person_add_line = fields.Boolean('Display information Lines', default=0,
                                             help="When you checked, on pos order lines screen, \n"
                                                  "will display information person created order \n"
                                                  "(lines) Eg: create date, updated date ..")
    internal_transfer = fields.Boolean('Allow Internal Transfer', default=0,
                                       help='Go Inventory and active multi warehouse and location')

    discount = fields.Boolean('POS Selection Discounts', default=0)
    discount_ids = fields.Many2many(
        'pos.global.discount',
        'pos_config_pos_global_discount_rel',
        'config_id',
        'discount_id',
        'Add Global Discounts')
    discount_manual = fields.Boolean(
        'Disable Discount Manual',
        default=1,
        help="If Checked: Not allow cashier set Discount viva number Numpad \n"
             "If not Check: Allow cashier set Discount viva number Numpad"
    )
    is_customer_screen = fields.Boolean('Is Customer Screen')
    delay = fields.Integer('Delay time', default=3000)
    slogan = fields.Char('Slogan', help='This is message will display on screen of customer')
    image_ids = fields.One2many('pos.config.image', 'config_id', 'Images')

    tooltip = fields.Boolean('Show information of product', default=0)
    tooltip_show_last_price = fields.Boolean(
        'Show last price of product',
        help='Show last price of items of customer have bought before',
        default=0)
    tooltip_show_minimum_sale_price = fields.Boolean(
        'Show min of product sale price',
        help='Show minimum sale price of product',
        default=0)
    discount_limit = fields.Boolean('Discount Limit', default=0)
    discount_limit_amount = fields.Float('Discount Limit (%)', default=10)
    discount_each_line = fields.Boolean('Discount each Line')
    discount_sale_price = fields.Boolean('Discount Sale Price')
    discount_sale_price_limit = fields.Float(
        'Discount Sale Price Limit',
        help='Cashier could not set discount price bigger than or equal this field'
    )
    return_products = fields.Boolean('Allow Cashier return Products/Orders',
                                     help='Allow cashier return products, orders',
                                     default=0)
    return_duplicate = fields.Boolean(
        'Allow duplicate return Order',
        help='If checked, one Order can return many times'
    )
    lock_order_printed_receipt = fields.Boolean('Lock Order Printed Receipt', default=0)

    validate_payment = fields.Boolean('Validate Payment')
    validate_remove_order = fields.Boolean('Validate Remove Order')
    validate_change_minus = fields.Boolean('Validate Pressed +/-')
    validate_quantity_change = fields.Boolean('Validate Qty Change')
    validate_price_change = fields.Boolean('Validate Price Change')
    validate_discount_change = fields.Boolean('Validate Discount Change')
    validate_close_session = fields.Boolean('Validate Close Session')
    apply_validate_return_mode = fields.Boolean(
        'Validate Return Mode',
        help='If checked, only applied validate when return order',
        default=1)

    print_user_card = fields.Boolean('Print User Card')

    product_operation = fields.Boolean(
        'Product Operation', default=0,
        help='Allow cashiers add pos categories and products on pos screen')
    quickly_payment_full = fields.Boolean('Quickly Paid Full')
    quickly_payment_full_method_id = fields.Many2one('pos.payment.method', 'Quickly Payment Method')
    note_order = fields.Boolean('Note Order', default=0)
    note_orderline = fields.Boolean('Note Order Line', default=0)
    signature_order = fields.Boolean('Signature Order', default=0)
    display_amount_discount = fields.Boolean('Display Amount Discount', default=0)

    booking_orders = fields.Boolean(
        'Booking Orders',
        default=0,
        help='Orders may be come from many sources locations\n'
             'Example: Web E-Commerce, Call center, or phone call order\n'
             'And your Cashiers will made Booking Orders and save it\n'
             'Your Shipper or customer come shop will delivery Orders')
    booking_orders_required_cashier_signature = fields.Boolean(
        'Required Signature',
        help='When your cashiers create Book Order\n'
             'Will require your cashier signature on order',
        default=0)
    booking_orders_alert = fields.Boolean(
        'Alert Order Coming', default=0,
        help='When have any Booking Order come from another Source Location to POS\n'
             'POS will Alert one popup inform your cashier have new Order coming')
    booking_allow_confirm_sale = fields.Boolean(
        'Delivery Booked Orders', default=0,
        help='Allow Cashier can Confirm Booked Orders and create Delivery Order')
    delivery_orders = fields.Boolean(
        'Delivery Order',
        help='Finish Order and Give Receipt to your Shipper delivery Order',
        default=0)
    booking_orders_display_shipping_receipt = fields.Boolean('Shipping Address Receipt', default=0)
    display_tax_orderline = fields.Boolean('Display Taxes Order Line', default=0)
    display_tax_receipt = fields.Boolean('Display Taxes Receipt', default=0)
    display_fiscal_position_receipt = fields.Boolean('Display Fiscal Position on Receipt', default=0)

    display_image_orderline = fields.Boolean('Display Image on Order Lines', default=0)
    display_image_receipt = fields.Boolean('Display Image on Receipt', default=0)
    duplicate_receipt = fields.Boolean(
        'Duplicate Receipt',
        help='If you need print bigger than 1 receipt / 1 order,\n'
             ' add bigger than 1')
    print_number = fields.Integer(
        'No.of Receipt',
        help='How many Bill need print on one Order', default=0)
    allow_cashier_update_print_number = fields.Boolean(
        'Allow Cashier Update Print Number',
        help='If checked, Cashier can change number of receipt viva Payment Screen'

    )
    category_wise_receipt = fields.Boolean(
        'Category Wise Receipt',
        default=0,
        help='Bill will wise each POS Category')
    management_invoice = fields.Boolean('Display Invoices Screen', default=0)
    wallet = fields.Boolean(
        'Wallet Card',
        help='Keeping all change money back to Customer Wallet Card\n'
             'Example: customer bought products with total amount is 9.5 USD\n'
             'Customer give your Cashier 10 USD, \n'
             'Default your cashier will return back change money 0.5 USD\n'
             'But Customer no want keep it, \n'
             'They need change money including to Wallet Card for next order\n'
             'Next Time customer come back, \n'
             'When your cashier choice client have Wallet Credit Amount bigger than 0\n'
             'Customer will have one more payment method viva Wallet Credit')
    invoice_journal_ids = fields.Many2many(
        'account.journal',
        'pos_config_invoice_journal_rel',
        'config_id',
        'journal_id',
        'Accounting Invoice Journal',
        domain=[('type', '=', 'sale')],
        help="Default POS Odoo save Invoice Journal from only one Invoicing Journal of POS Config\n"
             "This future allow you add many Journals here\n"
             "And when your cashier choice Journal on POS\n"
             "Invoice create from order will the same Journal selected by cashier")
    send_invoice_email = fields.Boolean(
        'Send email invoice',
        help='Help cashier send invoice to email of customer',
        default=0)
    pos_auto_invoice = fields.Boolean(
        'Auto Invoice',
        help='Auto check to button Invoice on POS Payment Screen',
        default=0)
    receipt_invoice_number = fields.Boolean('Add Invoice Number to Receipt',
                                            help='Show invoice number on receipt header',
                                            default=0)
    receipt_customer_vat = fields.Boolean('Add Customer Vat on Receipt',
                                          help='Show customer VAT(TIN) on receipt header', default=0)

    fiscal_position_auto_detect = fields.Boolean('Fiscal position auto detect', default=0)

    display_sale_price_within_tax = fields.Boolean('Display Sale Price Within Taxes', default=0)
    display_cost_price = fields.Boolean('Display Cost Price', default=0)
    display_product_ref = fields.Boolean('Display Product Ref', default=0)
    display_product_second_name = fields.Boolean(
        'Display Product Second Name',
        default=1,
        help='If you need show Product Second Name on product record \n'
             'Active it for display second name on order cart and receipt/bill'
    )
    hide_product_image = fields.Boolean('Hide Product Image', default=0)
    multi_location = fields.Boolean('Allow Multi Location', default=0)
    multi_location_check_stock_line_selected = fields.Boolean(
        'Check Stock On hand each Product',
        help='Allow cashier check stock on hand of line in cart selected'
    )
    multi_location_update_default_stock = fields.Boolean(
        'Change default Stock',
        help='Allow cashier change default pos warehouse stock'
    )
    multi_location_check_all_stock = fields.Boolean('Check stock on hand products all stock locations')
    product_view = fields.Selection([
        ('box', 'Box View'),
        ('list', 'List View'),
    ], default='box', string='Product Screen View Type', required=1)
    product_image_size = fields.Selection([
        ('default', 'Default'),
        ('small', 'Small'),
        ('big', 'Big')
    ],
        default='big',
        string='Product Image Size')
    ticket_font_size = fields.Integer('Bill Font Size', default=12,
                                      help='Font Size of Bill print viva Web, not support posbox')
    allow_ticket_font_size = fields.Boolean(
        'Allow Cashier change Fontsize',
        help='Allow Cashier change Fontsize of Receipt'
    )
    customer_default_id = fields.Many2one('res.partner', 'Customer Default', help='When you put customer here, \n'
                                                                                  'when cashier create new order, pos auto add this customer to order for default')
    medical_insurance = fields.Boolean('Medical insurance', default=0)
    set_guest = fields.Boolean('Set Guests', default=0)
    set_guest_when_add_new_order = fields.Boolean(
        'Auto Ask Guests',
        help='When Cashiers add Orders, pos auto popup and ask guest name and guest number')
    reset_sequence = fields.Boolean('Reset Sequence Order', default=0)
    update_tax = fields.Boolean(
        'Modify Taxes of Lines',
        default=0,
        help='Allow Cashiers can change Taxes of Lines')
    update_tax_ids = fields.Many2many(
        'account.tax',
        'pos_config_tax_rel',
        'config_id',
        'tax_id', string='List Taxes')
    subtotal_tax_included = fields.Boolean(
        'Show Tax-Included Prices',
        help='When checked, subtotal each line of Order Cart and Bill/Receipt will display Total Amount with taxes included')
    cash_out = fields.Boolean('Take Money Out', default=0, help='Allow cashiers take money out')
    cash_in = fields.Boolean('Push Money In', default=0, help='Allow cashiers input money in')
    min_length_search = fields.Integer(
        'Min Character Search',
        default=3,
        help='Allow auto suggestion items when cashiers input on search box')
    review_receipt_before_paid = fields.Boolean(
        'Display Receipt Before Payment',
        help='On Payment Screen and Client Screen,\n'
             ' receipt will render left page for review',
        default=1)
    keyboard_event = fields.Boolean(
        'Keyboard Event',
        default=1,
        help='Allow cashiers use shortcut keyboard')
    switch_user = fields.Boolean('Switch User', default=0, help='Allow cashiers user change between pos config')
    change_unit_of_measure = fields.Boolean('Change Unit of Measure', default=0,
                                            help='Allow cashiers change unit of measure of order lines')
    print_last_order = fields.Boolean(
        'Print Last Receipt',
        default=0,
        help='Allow cashiers print last receipt')
    close_session = fields.Boolean(
        'Logout Session, Logout Odoo',
        help='When cashiers click close pos, auto log out of system',
        default=0)
    display_image_product = fields.Boolean(
        'Display image product',
        default=1,
        help='Allow hide/display product images on pos screen')
    printer_on_off = fields.Boolean('On/Off printer', help='Help cashier turn on/off printer via posbox', default=0)
    check_duplicate_email = fields.Boolean('Check duplicate email', default=0)
    check_duplicate_phone = fields.Boolean('Check duplicate phone', default=0)
    hide_country = fields.Boolean('Hide Country', default=0)
    hide_barcode = fields.Boolean('Hide Barcode', default=0)
    hide_tax = fields.Boolean('Hide Taxes', default=0)
    hide_pricelist = fields.Boolean('Hide Pricelists', default=0)
    quickly_search_client = fields.Boolean("Quickly Search Client", default=1)
    show_order_unique_barcode = fields.Boolean(
        'Show Unique Barcode',
        help='If your business have take away, customers come shop and order\n'
             'When customer need to pay, cashiers dont know what order correct each customer\n'
             'Each order we will add barcode for index order on receipt\n'
             'When sellers take order from customers, they will give receipt have barcode included to customers\n'
             'Customer need pay, they give receipt to your cashiers\n'
             'Cashiers will use barcode device and scan this barcode\n'
             'POS auto find order have this barcode, and auto switch to order have the same barcode\n'
             'And so cashiers easy and made payment for customer')
    auto_remove_line = fields.Boolean(
        'Auto Remove Line',
        default=1,
        help='When cashier set quantity of line to 0, \n'
             'line auto remove not keep line with qty is 0')
    chat = fields.Boolean('Chat message', default=0, help='Allow chat, discuss between pos sessions')
    add_tags = fields.Boolean('Add Tags', default=0, help='Allow cashiers add tags to order lines')
    add_sale_person = fields.Boolean('Add Sale Person', default=0)
    default_seller_id = fields.Many2one('res.users', 'Default Seller')
    seller_ids = fields.Many2many(
        'res.users', 'pos_config_sellers_rel', 'config_id', 'user_id', 'Sellers',
        help='Add sellers here, cashier can choice seller\n'
             ' and add to pos order on pos screen')
    force_seller = fields.Boolean(
        'Force Seller',
        help='If checked, when cashier select sale person each line\n'
             ', Auto assigned to sale person order and each line',
        default=0)
    fast_remove_line = fields.Boolean('Fast Remove Line', default=1)
    logo = fields.Binary('Receipt Logo')
    paid_full = fields.Boolean(
        'Allow Paid Full', default=0,
        help='Allow cashiers click one button, do payment full order')
    paid_partial = fields.Boolean(
        'Allow Partial Payment', default=0,
        help='Allow cashiers payment one part of Total Amount Order')
    backup = fields.Boolean(
        'Backup/Restore Orders', default=0,
        help='Allow cashiers backup and restore orders on pos screen')
    backup_orders = fields.Text('Backup Orders', readonly=1)
    change_logo = fields.Boolean(
        'Change Shop Logo', default=1, help='Allow cashiers change logo of shop on pos screen')
    management_session = fields.Boolean(
        'Management Cash Control',
        default=0,
        help='Allow pos users can take money in/out session\n'
             'If you active this future please active Cash Control of POS Odoo Original too'
    )
    cash_inout_reason_ids = fields.Many2many(
        'product.product',
        'pos_config_cash_inout_product_rel',
        'config_id',
        'product_id',
        sting='Cash In/Out Reason')
    barcode_receipt = fields.Boolean('Display Barcode Receipt', default=0)

    hide_mobile = fields.Boolean("Hide Client's Mobile", default=1)
    hide_phone = fields.Boolean("Hide Client's Phone", default=1)
    hide_email = fields.Boolean("Hide Client's Email", default=1)
    update_client = fields.Boolean('Allow Update Clients',
                                   help='Uncheck if you dont want cashier change customer information on pos')
    add_client = fields.Boolean('Add Client', help='Allow POS Session can create new Client')
    remove_client = fields.Boolean('Allow Remove Clients',
                                   help='Uncheck if you dont want cashier remove customers on pos')
    mobile_responsive = fields.Boolean('Mobile Mode', default=0)
    report_no_of_report = fields.Integer(string="No.of copy Receipt", default=1)
    report_signature = fields.Boolean(string="Report Signature", default=0)

    report_product_summary = fields.Boolean(string="Report Product Summary", default=0)
    report_product_current_month_date = fields.Boolean(string="Report This Month", default=0)
    report_product_summary_auto_check_product = fields.Boolean('Auto Checked to Product Summary')
    report_product_summary_auto_check_category = fields.Boolean('Auto Checked to Product Category Summary')
    report_product_summary_auto_check_location = fields.Boolean('Auto Checked to Product Location Summary')
    report_product_summary_auto_check_payment = fields.Boolean('Auto Checked to Product Payment Summary')

    report_order_summary = fields.Boolean(string='Report Order Summary', default=0)
    report_order_current_month_date = fields.Boolean(string="Report Current Month", default=0)
    report_order_summary_auto_check_order = fields.Boolean('Auto Checked to Order Summary')
    report_order_summary_auto_check_category = fields.Boolean('Auto Checked to Order Category Summary')
    report_order_summary_auto_check_payment = fields.Boolean('Auto Checked to Order Payment Summary')
    report_order_summary_default_state = fields.Selection([
        ('new', 'New'),
        ('paid', 'Paid'),
        ('posted', 'Posted'),
        ('invoiced', 'Invoiced'),
        ('all', 'All')
    ], string='Report with state', default='all')

    report_payment_summary = fields.Boolean(string="Report Payment Summary", default=0)
    report_payment_current_month_date = fields.Boolean(string="Payment Current Month", default=0)

    report_sale_summary = fields.Boolean('Report Sale Summary (Z-Report)')
    report_sale_summary_show_profit = fields.Boolean('Report Sale Summary show Gross/Profit')
    report_current_session_report = fields.Boolean('Auto checked current session')

    active_product_sort_by = fields.Boolean('Active Sort By Product', default=0)
    default_product_sort_by = fields.Selection([
        ('a_z', 'Sort Name A to Z'),
        ('z_a', 'Sort Name Z to A'),
        ('low_price', 'Sort from Low to High Sale Price'),
        ('high_price', 'Sort from High to Low Sale Price'),
        ('pos_sequence', 'Product POS Sequence')
    ], string='Default Sort By', default='a_z')
    add_customer_before_products_already_in_shopping_cart = fields.Boolean(
        'Required choice Client before Add to Cart',
        help='Add customer before products \n'
             'already in shopping cart',
        default=0)
    allow_cashier_select_pricelist = fields.Boolean(
        'Allow Cashier select Pricelist',
        help='If uncheck, pricelist only work when select customer.\n'
             ' Cashiers could not manual choose pricelist',
        default=1)
    big_datas_turbo = fields.Boolean('Turbo Starting POS Session')
    big_datas_sync_backend = fields.Boolean(
        'Auto Sync Reltime with Backend',
        help='If have any change Products/Customer. POS auto sync with event change',
        default=1)
    sale_with_package = fields.Boolean(
        'Sale with Package')
    allow_set_price_smaller_min_price = fields.Boolean(
        'Allow Cashier set Price smaller than Sale Price of Product',
        default=1)
    checking_lot = fields.Boolean(
        'Validate Lot/Serial Number',
        help='Validate lot name input by cashiers is wrong or correctly')

    sync_sales = fields.Boolean(
        'Sync Sales/Quotations', default=1,
        help='Synchronize quotations/sales order between backend and pos')
    auto_nextscreen_when_validate_payment = fields.Boolean(
        'Auto Next Screen',
        help='Auto Next Screen when Cashiers Validate Order',
        default=1)
    auto_print_web_receipt = fields.Boolean('Auto Print Web Receipt', default=1)
    multi_lots = fields.Boolean('Allow Multi Lots/Serial', help='One order line can set many lots')
    create_lots = fields.Boolean('Allow Create Lots/Serial', help='Allow cashier create lots on pos')
    promotion_ids = fields.Many2many(
        'pos.promotion',
        'pos_config_promotion_rel',
        'config_id',
        'promotion_id',
        string='Promotions Applied')
    replace_payment_screen = fields.Boolean(
        'Replace Payment Screen', default=0,
        help='If checked, payment screen and products made to one \n'
             'Keyboard of payment screen will turn off\n'
             'This future only support on PC, without mobile tablet')
    pos_branch_id = fields.Many2one('pos.branch', 'Branch')

    stock_location_ids = fields.Many2many(
        'stock.location', string='Stock Locations',
        help='Stock Locations for cashier select checking stock on hand \n'
             'and made picking source location from location selected',
        domain=[('usage', '=', 'internal')])
    validate_by_manager = fields.Boolean('Validate by Managers')
    discount_unlock_by_manager = fields.Boolean('Unlock Limit Discount by Manager')
    manager_ids = fields.Many2many('res.users', 'pos_config_res_user_manager_rel', 'config_id', 'user_id',
                                   string='Manager Validation')
    stock_location_id = fields.Many2one('stock.location', string='POS Default Source Location',
                                        related='picking_type_id.default_location_src_id',
                                        readonly=1)
    stock_location_dest_id = fields.Many2one('stock.location', string='POS Default Dest Location',
                                             related='picking_type_id.default_location_dest_id',
                                             readonly=1)
    receipt_display_subtotal = fields.Boolean('Receipt Display Sub Total', default=1)
    receipt_display_taxes = fields.Boolean('Receipt Display Taxes', default=1)
    receipt_display_warehouse = fields.Boolean('Receipt Display Warehouse', default=0)
    receipt_header_style = fields.Selection([
        ('left', 'Left'),
        ('center', 'Center'),
        ('right', 'Right')
    ],
        default='left',
        string='Header Receipt Style',
        help='Header style, this future only apply on posbox and printer connected\n'
             'Not apply for printer direct web browse'
    )
    design = fields.Boolean("Design POS Screen")
    design_background_color = fields.Char(
        string='Background Color',
        help="Here you can set a specific background color index (e.g. #ff0000) \n"
             " to display the color if the attribute type is 'Color'.")
    design_header_background_color = fields.Char(
        string='Header Background Color',
        help="Here you can set a specific background color index (e.g. #ff0000) \n"
             "to display the color if the attribute type is 'Color'.")
    design_button_background_color = fields.Char(
        string='Button Background Color',
        help="Here you can set a specific background color index (e.g. #ff0000) \n"
             "to display the color if the attribute type is 'Color'.")
    design_button_color = fields.Char(
        string='Button Color',
        help="Here you can set a specific background color index (e.g. #ff0000) \n"
             "to display the color if the attribute type is 'Color'.")
    validate_order_without_receipt = fields.Boolean(
        'Validate Order without Receipt',
        help='If checked, on pos payment screen, \n'
             'will have one button allow validate order without print Receipt',
        default=1
    )
    discount_value = fields.Boolean('Global Discount Value')
    discount_value_limit = fields.Float(
        'Global Discount Limit',
        help='This is limited money cashier can apply'
    )
    posbox_older_version = fields.Boolean(
        'Posbox Olders Version',
        help='if you used posbox older version from 18.10 and older,\n'
             ' please check to this field for support printing bill \n'
             'If you used Odoo EE but need use posbox (not iotbox) \n'
             'Please remove module pos_enterpeise of Odoo Original')
    posbox_save_orders = fields.Boolean('Save Orders on PosBox')
    posbox_save_orders_iot_ids = fields.Many2many(
        'pos.iot',
        'pos_config_iot_save_orders_rel',
        'config_id',
        'iot_id',
        string='IoT boxes'
    )
    posbox_save_orders_server_ip = fields.Char(
        'Odoo Public Ip Address',
        help='Example Ip: 192.168.100.100'
    )
    posbox_save_orders_server_port = fields.Char(
        'Odoo Public Port Number',
        default='8069',
        help='Example Port: 8069'
    )
    analytic_account_id = fields.Many2one(
        'account.analytic.account',
        'Analytic Account'
    )
    limit_categories = fields.Boolean("Restrict Available Product Categories")
    iface_available_categ_ids = fields.Many2many(
        'pos.category',
        string='Available PoS Product Categories',
        help='The point of sale will only display products \n'
             'which are within one of the selected category trees. \n'
             'If no category is specified, all available products will be shown')
    barcode_scan_with_camera = fields.Boolean(
        'Use Camera Scan Barcode',
        help='If you check it, and your device use POS have camera \n'
             'You can use camera of device scan barcode for add products, return orders ....\n'
             'This future only supported web browse and SSL \n'
             'SSL required if you are on cloud. As without SSL permission of camera not work.'
    )

    allow_auto_rounding = fields.Boolean('Auto Rounding')
    rounding = fields.Float('Rounding Factor', default=0.001, digits=(16, 6))
    rounding_total_paid = fields.Boolean('Rounding Amount Paid')
    dynamic_combo = fields.Boolean(
        'Dynamic Combo',
        help='One Order Line can add many combo items,\n'
             'Combo items is product have checked Combo Item field \n'
             'When Combo Item add, price extra will included to Order Line selected \n'
             'If you active this future, please go to Products and check to Combo Item field \n'
             'And set Combo Price, POS Combo Category both for product combo item')

    service_charge_ids = fields.Many2many(
        'pos.service.charge',
        'pos_config_service_charge_rel',
        'config_id',
        'charge_id',
        string='Services Charge'
    )
    payment_reference = fields.Boolean(
        'Payment Reference',
        help='Allow cashier add reference Note each payment line'
    )
    display_margin = fields.Boolean('Display Margin %')

    def remove_sync_between_session_logs(self):
        for config in self:
            sessions = self.env['pos.session'].search([(
                'config_id', '=', config.id
            )])
            session_ids = [session.id for session in sessions]
            self.env['pos.sync.session.log'].search([
                ('send_to_session_id', 'in', session_ids)
            ]).unlink()
        return True

    def reinstall_database(self):
        ###########################################################################################################
        # new field append :
        #                    - update param
        #                    - remove logs datas
        #                    - remove cache
        #                    - reload pos
        #                    - reinstall pos data
        # reinstall data button:
        #                    - remove all param
        #                    - pos start save param
        #                    - pos reinstall with new param
        # refresh call logs:
        #                    - get fields domain from param
        #                    - refresh data with new fields and domain
        ###########################################################################################################
        parameters = self.env['ir.config_parameter'].sudo().search([('key', 'in',
                                                                     ['product.product', 'res.partner',
                                                                      'account.invoice',
                                                                      'account.invoice.line', 'pos.order',
                                                                      'pos.order.line',
                                                                      'sale.order', 'sale.order.line'])])
        if parameters:
            parameters.sudo().unlink()
        del_database_sql = ''' delete from pos_cache_database'''
        del_log_sql = ''' delete from pos_call_log'''
        self.env.cr.execute(del_database_sql)
        self.env.cr.execute(del_log_sql)
        self.env.cr.commit()
        for config in self:
            sessions = self.env['pos.session'].sudo().search(
                [('config_id', '!=', config.id), ('state', '!=', 'closed')])
            sessions.write({'required_reinstall_cache': True})
            config_fw = config
        self.env['pos.cache.config'].sudo().search([]).unlink()
        return {
            'type': 'ir.actions.act_url',
            'url': '/pos/web?config_id=%d' % config_fw.id,
            'target': 'self',
        }

    def remote_sessions(self):
        return {
            'name': _('Remote sessions'),
            'view_type': 'form',
            'target': 'new',
            'view_mode': 'form',
            'res_model': 'pos.remote.session',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'context': {},
        }

    def validate_and_post_entries_session(self):
        for config in self:
            sessions = self.env['pos.session'].search([('config_id', '=', config.id), ('state', '=', 'opened')])
            if sessions:
                sessions.action_pos_session_closing_control()
                sessions.action_pos_session_validate()

    def write(self, vals):
        if vals.get('allow_discount', False) or vals.get('allow_qty', False) or vals.get('allow_price', False):
            vals['allow_numpad'] = True
        if vals.get('expired_days_voucher', None) and vals.get('expired_days_voucher') < 0:
            raise UserError('Expired days of voucher could not smaller than 0')
            if config.pos_order_period_return_days <= 0:
                raise UserError('Period days return orders and products required bigger than or equal 0 day')
        res = super(pos_config, self).write(vals)
        for config in self:
            if vals.get('management_session', False) and not vals.get('default_cashbox_lines_ids'):
                if not config.default_cashbox_id and not config.cash_control:
                    raise UserError(
                        'Your POS config missed config Default Opening (Cash Control), Please go to Cash control and set Default Opening')
            self.env['pos.cache.config'].sudo().search([('config_id', '=', config.id)]).unlink()
        return res

    @api.model
    def create(self, vals):
        if vals.get('allow_discount', False) or vals.get('allow_qty', False) or vals.get('allow_price', False):
            vals['allow_numpad'] = True
        if vals.get('expired_days_voucher', 0) < 0:
            raise UserError('Expired days of voucher could not smaller than 0')
        config = super(pos_config, self).create(vals)
        if config.pos_order_period_return_days <= 0:
            raise UserError('Period days return orders and products required bigger than or equal 0 day')
        if config.management_session and not config.default_cashbox_lines_ids and not config.cash_control:
            raise UserError(
                'Your POS config missed config Default Opening (Cash Control), Please go to Cash control and set Default Opening')
        return config

    @api.model
    @api.onchange('management_session')
    def _onchange_management_session(self):
        self.cash_control = self.management_session

    def init_payment_method(self, journal_name, journal_sequence, journal_code, account_code, pos_method_type):
        Journal = self.env['account.journal'].sudo()
        Method = self.env['pos.payment.method'].sudo()
        IrModelData = self.env['ir.model.data'].sudo()
        IrSequence = self.env['ir.sequence'].sudo()
        Account = self.env['account.account'].sudo()
        user = self.env.user
        accounts = Account.search([
            ('code', '=', account_code), ('company_id', '=', user.company_id.id)])
        if accounts:
            accounts.sudo().write({'reconcile': True})
            account = accounts[0]

        else:
            account = Account.create({
                'name': journal_name,
                'code': account_code,
                'user_type_id': self.env.ref('account.data_account_type_current_assets').id,
                'company_id': user.company_id.id,
                'note': 'code "%s" auto give voucher histories of customers' % account_code,
                'reconcile': True
            })
            model_datas = IrModelData.search([
                ('name', '=', account_code + str(user.company_id.id)),
                ('module', '=', 'pos_retail'),
                ('model', '=', 'account.account'),
                ('res_id', '=', account.id),
            ])
            if not model_datas:
                IrModelData.create({
                    'name': account_code + str(user.company_id.id),
                    'model': 'account.account',
                    'module': 'pos_retail',
                    'res_id': account.id,
                    'noupdate': True,  # If it's False, target record (res_id) will be removed while module update
                })

        journals = Journal.search([
            ('code', '=', journal_code),
            ('company_id', '=', user.company_id.id),
        ])
        if journals:
            journals.sudo().write({
                'default_debit_account_id': account.id,
                'default_credit_account_id': account.id,
                'pos_method_type': pos_method_type,
                'sequence': journal_sequence,
            })
            journal = journals[0]
        else:
            new_sequence = IrSequence.create({
                'name': journal_name + str(user.company_id.id),
                'padding': 3,
                'prefix': account_code + str(user.company_id.id),
            })
            model_datas = IrModelData.search(
                [
                    ('name', '=', account_code + str(new_sequence.id)),
                    ('module', '=', 'pos_retail'),
                    ('model', '=', 'ir.sequence'),
                    ('res_id', '=', new_sequence.id),
                ])
            if not model_datas:
                IrModelData.create({
                    'name': account_code + str(new_sequence.id),
                    'model': 'ir.sequence',
                    'module': 'pos_retail',
                    'res_id': new_sequence.id,
                    'noupdate': True,
                })
            journal = Journal.create({
                'name': journal_name,
                'code': journal_code,
                'type': 'cash',
                'pos_method_type': pos_method_type,
                'sequence_id': new_sequence.id,
                'company_id': user.company_id.id,
                'default_debit_account_id': account.id,
                'default_credit_account_id': account.id,
                'sequence': journal_sequence,
            })
            model_datas = IrModelData.search(
                [
                    ('name', '=', account_code + str(journal.id)),
                    ('module', '=', 'pos_retail'),
                    ('model', '=', 'account.journal'),
                    ('res_id', '=', int(journal.id)),
                ])
            if not model_datas:
                IrModelData.create({
                    'name': account_code + str(journal.id),
                    'model': 'account.journal',
                    'module': 'pos_retail',
                    'res_id': int(journal.id),
                    'noupdate': True,
                })
        methods = Method.search([
            ('name', '=', journal_name),
            ('company_id', '=', user.company_id.id)
        ])
        if not methods:
            method = Method.create({
                'name': journal_name,
                'receivable_account_id': account.id,
                'is_cash_count': True,
                'cash_journal_id': journal.id,
                'company_id': user.company_id.id,
            })
        else:
            method = methods[0]
        for config in self:
            opened_session = config.mapped('session_ids').filtered(lambda s: s.state != 'closed')
            if not opened_session:
                payment_method_added_ids = [payment_method.id for payment_method in config.payment_method_ids]
                if method.id not in payment_method_added_ids:
                    payment_method_added_ids.append(method.id)
                    config.sudo().write({
                        'payment_method_ids': [(6, 0, payment_method_added_ids)],
                    })
        return True

    def open_ui(self):
        self.init_payment_method('Voucher', 100, 'JV', 'AJV', 'voucher')
        self.init_payment_method('Wallet', 101, 'JW', 'AJW', 'wallet')
        self.init_payment_method('Credit', 102, 'JC', 'AJC', 'credit')
        self.init_payment_method('Return Order', 103, 'JRO', 'AJRO', 'return')
        self.init_payment_method('Rounding Amount', 100, 'JRA', 'AJRA', 'rounding')
        return super(pos_config, self).open_ui()

    def open_session_cb(self):
        self.init_payment_method('Voucher', 100, 'JV', 'AJV', 'voucher')
        self.init_payment_method('Wallet', 101, 'JW', 'AJW', 'wallet')
        self.init_payment_method('Credit', 102, 'JC', 'AJC', 'credit')
        self.init_payment_method('Return Order', 103, 'JRO', 'AJRO', 'return')
        self.init_payment_method('Rounding Amount', 100, 'JRA', 'AJRA', 'rounding')
        return super(pos_config, self).open_session_cb()
