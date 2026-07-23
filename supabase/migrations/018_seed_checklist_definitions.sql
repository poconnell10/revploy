-- 018_seed_checklist_definitions.sql
-- Seed the 22 operational checklist definitions (100 points total).

INSERT INTO operational_checklist_definitions (item_key, category, display_name, points, is_auto, order_index) VALUES
-- Foundational Kick Off Calls
('gm_power_up', 'kickoff_calls', 'GM Power Up Completed', 7.5, false, 1),
('laying_foundations', 'kickoff_calls', 'Laying the Foundations Completed', 7.5, false, 2),
('champions_power_up', 'kickoff_calls', 'Champions Power Up Completed', 10, false, 3),
('frontline_power_up', 'kickoff_calls', 'Frontline Power Up Completed', 7.5, false, 4),
-- Products & Revenue Forecasts
('complete_forecast', 'products_revenue', 'Complete Forecast', 5, false, 5),
('confirm_products_setup', 'products_revenue', 'Confirm Products Setup Match Forecast', 5, false, 6),
('product_information', 'products_revenue', 'Product Information Confirmed', 2.5, false, 7),
('confirm_incentives', 'products_revenue', 'Confirm Incentives', 2.5, false, 8),
-- Front Desk SOP & Data
('confirm_champions', 'front_desk_sop', 'Confirm Champions', 5, false, 9),
('confirm_test_room_upsell', 'front_desk_sop', 'Confirm Test Room Upsell', 2.5, true, 10),
('confirm_test_other_upsell', 'front_desk_sop', 'Confirm Test Other Product Upsell', 2.5, true, 11),
('data_rules_signed_off', 'front_desk_sop', 'Data Rules Signed Off By Hotel', 2.5, true, 12),
('confirm_upsell_sop', 'front_desk_sop', 'Confirm Upsell SOP on PMS is Understood', 5, false, 13),
-- E-Learning Status
('champion_elearning', 'elearning', 'Champion E-Learning Completed', 7.5, true, 14),
('agent_elearning', 'elearning', 'Agent E-Learning Completed', 10, true, 15),
-- Administrative
('call_schedule_setup', 'administrative', 'Call Schedule Set Up', 2.5, false, 16),
('confirm_invoice_received', 'administrative', 'Confirm Invoice Was Received', 2.5, false, 17),
('confirm_invoice_paid', 'administrative', 'Confirm Invoice Paid', 2.5, false, 18),
-- IN-Gauge Operational Checks
('ingauge_users_active', 'ingauge_ops', 'Confirm Users Are Invited & Active', 2.5, true, 19),
('ingauge_incentives_configured', 'ingauge_ops', 'Configure Incentives in IN-Gauge', 2.5, true, 20),
('ingauge_first_goal', 'ingauge_ops', '1st Month Goal Set Up', 2.5, true, 21),
('ingauge_auditing', 'ingauge_ops', 'Auditing Occurring', 2.5, true, 22);
