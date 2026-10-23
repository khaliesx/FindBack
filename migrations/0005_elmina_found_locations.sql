-- Area-level names for reports carried over from the original demo.
-- Reported location and collection desk remain separate item fields.
UPDATE items SET location = 'Elmina Central Park' WHERE location = 'Central Park';
UPDATE items SET location = 'Elmina Green Seven' WHERE location = 'Clubhouse';
UPDATE items SET location = 'Elmina Lakeside Mall' WHERE location = 'Retail Square';
UPDATE items SET location = 'Elmina Urban Park' WHERE location = 'Community Garden';
