import React, { useState } from 'react';
import { formatMoney } from '../utils/format';
import { useLocale } from '../context/LocaleContext';
import { Backspace } from '@mui/icons-material';

const SimpleCalculator = ({ isDarkMode }) => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const { t } = useLocale();

  const handleButtonClick = (value) => {
    if (value === 'C') {
      setInput('');
      setResult('');
    } else if (value === '=') {
      try {
        const evalResult = eval(input);
        setResult(formatMoney(evalResult));
        setInput('');
      } catch (error) {
        setResult(t('error'));
      }
    } else if (value === 'Backspace') {
      setInput(input.slice(0, -1));
    } else if (value === '.') {
      // split by operators and check last number
      const numbers = input.split(/[\+\-\*\/]/);
      if (!numbers[numbers.length - 1].includes('.')) {
        setInput(input + value);
      }
    } else {
      setInput(input + value);
    }
  };

  return (
    <div className="simple-calculator" data-theme={isDarkMode ? 'dark' : 'light'}>
      <div className="simple-calculator-display">
        <input type="text" value={input} className="simple-calculator-input" readOnly />
        <div className="simple-calculator-result">{result}</div>
      </div>
      <div className="simple-calculator-buttons">
        <button onClick={() => handleButtonClick('1')}>1</button>
        <button onClick={() => handleButtonClick('2')}>2</button>
        <button onClick={() => handleButtonClick('3')}>3</button>
        <button className="operator" onClick={() => handleButtonClick('+')}>+</button>

        <button onClick={() => handleButtonClick('4')}>4</button>
        <button onClick={() => handleButtonClick('5')}>5</button>
        <button onClick={() => handleButtonClick('6')}>6</button>
        <button className="operator" onClick={() => handleButtonClick('-')}>-</button>

        <button onClick={() => handleButtonClick('7')}>7</button>
        <button onClick={() => handleButtonClick('8')}>8</button>
        <button onClick={() => handleButtonClick('9')}>9</button>
        <button className="operator" onClick={() => handleButtonClick('*')}>*</button>

        <button onClick={() => handleButtonClick('.')}>.</button>
        <button onClick={() => handleButtonClick('0')}>0</button>
        <button onClick={() => handleButtonClick('C')}>C</button>
        <button className="operator" onClick={() => handleButtonClick('/')}>/</button>

        <button className="equal" onClick={() => handleButtonClick('=')}>=</button>
        <button onClick={() => handleButtonClick('Backspace')}><Backspace /></button>
      </div>
    </div>
  );
};

export default SimpleCalculator;
