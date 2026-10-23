UPDATE users SET collection_point = 'Elmina Lakeside Mall Centre Management Office' WHERE collection_point = 'Township management office';
UPDATE users SET collection_point = 'Elmina Rainforest Knowledge Centre (ERKC)' WHERE collection_point = 'Central Park security desk';
UPDATE users SET collection_point = 'Elmina Green 7 Management Office' WHERE collection_point = 'Clubhouse reception';
UPDATE users SET name = 'Mei Ling (ERKC)' WHERE id = 'U-DEMO-STP' AND name = 'Mei Ling (Central Park)';
UPDATE users SET name = 'Hafiz (Elmina Green 7)' WHERE id = 'U-DEMO-STC' AND name = 'Hafiz (Clubhouse)';
UPDATE items SET collection = 'Elmina Lakeside Mall Centre Management Office' WHERE collection = 'Township management office';
UPDATE items SET collection = 'Elmina Rainforest Knowledge Centre (ERKC)' WHERE collection = 'Central Park security desk';
UPDATE items SET collection = 'Elmina Green 7 Management Office' WHERE collection = 'Clubhouse reception';
