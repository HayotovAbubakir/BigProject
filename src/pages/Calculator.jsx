import React, { useState } from 'react';
import SimpleCalculator from '../components/SimpleCalculator';
import ProductCalculator from '../components/ProductCalculator';
import { useThemeMode } from '../context/ThemeModeContext';
import { useLocale } from '../context/LocaleContext';
import './Calculator.css';

const Calculator = () => {
  const [activeCalculator, setActiveCalculator] = useState('simple'); // 'simple' or 'product'
  const { isDarkMode } = useThemeMode();
  const { t } = useLocale();

  return (
    <div className="calculator-page" data-theme={isDarkMode ? 'dark' : 'light'}>
      <div className="calculator-toggle">
        <button 
          onClick={() => setActiveCalculator('simple')}
          className={activeCalculator === 'simple' ? 'active' : ''}
        >
          {t('simpleCalculator')}
        </button>
        <button 
          onClick={() => setActiveCalculator('product')}
          className={activeCalculator === 'product' ? 'active' : ''}
        >
          {t('productCalculator')}
        </button>
      </div>
      <hr />
      {activeCalculator === 'simple' ? <SimpleCalculator isDarkMode={isDarkMode} /> : <ProductCalculator isDarkMode={isDarkMode} />}
    </div>
  );
};

export default Calculator;