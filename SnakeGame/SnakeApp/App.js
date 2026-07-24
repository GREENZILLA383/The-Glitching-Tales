import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

const BOARD_SIZE = 20;
const { width } = Dimensions.get('window');
// Calculate cell size leaving some padding
const CELL_SIZE = Math.floor((width - 40) / BOARD_SIZE);

const randomFoodPosition = (snake) => {
  let position;
  while (true) {
    position = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    };
    if (!snake.some(segment => segment.x === position.x && segment.y === position.y)) {
      break;
    }
  }
  return position;
};

export default function App() {
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState(randomFoodPosition([{ x: 10, y: 10 }]));
  const [direction, setDirection] = useState({ x: 0, y: -1 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      moveSnake();
    }, 150);

    return () => clearInterval(interval);
  }, [snake, direction, gameOver]);

  const moveSnake = () => {
    const newSnake = [...snake];
    const head = { ...newSnake[0] };

    head.x += direction.x;
    head.y += direction.y;

    // Check collision with walls
    if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
      setGameOver(true);
      return;
    }

    // Check collision with self
    if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
      setGameOver(true);
      return;
    }

    newSnake.unshift(head);

    // Check food collision
    if (head.x === food.x && head.y === food.y) {
      setScore(s => s + 1);
      setFood(randomFoodPosition(newSnake));
    } else {
      newSnake.pop();
    }

    setSnake(newSnake);
  };

  const changeDirection = (newDir) => {
    // Prevent 180 degree turns
    if (direction.x === -newDir.x && direction.y === -newDir.y) return;
    setDirection(newDir);
  };

  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(randomFoodPosition([{ x: 10, y: 10 }]));
    setDirection({ x: 0, y: -1 });
    setGameOver(false);
    setScore(0);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Snake Game</Text>
      <Text style={styles.scoreText}>Score: {score}</Text>
      
      <View style={styles.board}>
        {Array.from({ length: BOARD_SIZE }).map((_, row) => (
          <View key={`row-${row}`} style={styles.row}>
            {Array.from({ length: BOARD_SIZE }).map((_, col) => {
              const isSnake = snake.some(segment => segment.x === col && segment.y === row);
              const isHead = snake[0].x === col && snake[0].y === row;
              const isFood = food.x === col && food.y === row;
              return (
                <View
                  key={`cell-${col}-${row}`}
                  style={[
                    styles.cell,
                    isSnake && styles.snakeCell,
                    isHead && styles.snakeHead,
                    isFood && styles.foodCell,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      {gameOver && (
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverText}>Game Over!</Text>
          <TouchableOpacity style={styles.button} onPress={resetGame}>
            <Text style={styles.buttonText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.controlButton} onPress={() => changeDirection({ x: 0, y: -1 })}>
            <Text style={styles.controlText}>↑</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.controlButton} onPress={() => changeDirection({ x: -1, y: 0 })}>
            <Text style={styles.controlText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => changeDirection({ x: 0, y: 1 })}>
            <Text style={styles.controlText}>↓</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => changeDirection({ x: 1, y: 0 })}>
            <Text style={styles.controlText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 5,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    marginBottom: 15,
  },
  board: {
    width: BOARD_SIZE * CELL_SIZE,
    height: BOARD_SIZE * CELL_SIZE,
    backgroundColor: '#2C2C2C',
    borderColor: '#444',
    borderWidth: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderColor: '#333',
    borderWidth: 0.5,
  },
  snakeCell: {
    backgroundColor: '#81C784',
    borderRadius: 2,
  },
  snakeHead: {
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  foodCell: {
    backgroundColor: '#FF5252',
    borderRadius: CELL_SIZE / 2,
  },
  gameOverContainer: {
    position: 'absolute',
    top: '35%',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FF5252',
    zIndex: 10,
  },
  gameOverText: {
    fontSize: 32,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  controls: {
    marginTop: 20,
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  controlButton: {
    backgroundColor: '#424242',
    width: 65,
    height: 65,
    margin: 8,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  controlText: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
  },
});
