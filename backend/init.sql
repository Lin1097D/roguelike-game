USE roguelike;

CREATE TABLE IF NOT EXISTS equipment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  slot VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  quality VARCHAR(20) NOT NULL,
  stat_value FLOAT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES user(id)
);