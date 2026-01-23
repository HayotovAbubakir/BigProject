import React, { useState, useMemo, useEffect } from 'react';
import { formatMoney, parseNumber } from '../utils/format';
import { useLocale } from '../context/LocaleContext';

const ProductCalculator = ({ isDarkMode }) => {
  const [products, setProducts] = useState([]);
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('UZS');
  const [exchangeRate, setExchangeRate] = useState(() => {
    const savedRate = localStorage.getItem('exchangeRate');
    return savedRate ? parseFloat(savedRate) : 12000;
  });
  const { t } = useLocale();

  useEffect(() => {
    localStorage.setItem('exchangeRate', exchangeRate);
  }, [exchangeRate]);

  const addProduct = () => {
    if (productName && quantity && price) {
      setProducts([...products, { name: productName, quantity: parseFloat(quantity), price: parseNumber(price) }]);
      setProductName('');
      setQuantity('');
      setPrice('');
    }
  };

  const total = useMemo(() => {
    return products.reduce((acc, product) => acc + product.quantity * product.price, 0);
  }, [products]);

  const convertedTotal = useMemo(() => {
    if (currency === 'USD') {
      return total * exchangeRate;
    }
    return total / exchangeRate;
  }, [total, currency, exchangeRate]);

  const handleExchangeRateChange = (e) => {
    const newRate = parseFloat(e.target.value);
    if (!isNaN(newRate)) {
      setExchangeRate(newRate);
    }
  }

  return (
    <div className="product-calculator" data-theme={isDarkMode ? 'dark' : 'light'}>
      <div className="product-calculator-card">
        <div className="product-calculator-form">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="UZS">UZS</option>
            <option value="USD">USD</option>
          </select>
          <input
            type="number"
            placeholder={t('exchangeRate')}
            value={exchangeRate}
            onChange={handleExchangeRateChange}
          />
          <input
            type="text"
            placeholder={t('productName')}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
          <input
            type="number"
            placeholder={t('quantity')}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <input
            type="text"
            placeholder={t('price')}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <button onClick={addProduct}>{t('add')}</button>
        </div>
      </div>
      <div className="product-calculator-card">
        <div className="product-calculator-list">
          <ul>
            {products.map((product, index) => (
              <li key={index}>
                <span>{product.quantity} x {product.name} @ {formatMoney(product.price)}</span>
                <span>{formatMoney(product.quantity * product.price)} {currency}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="product-calculator-total">
          <strong>{t('total')}: {formatMoney(total)} {currency}</strong>
          <br />
          <small>({formatMoney(convertedTotal)} {currency === 'USD' ? 'UZS' : 'USD'})</small>
        </div>
      </div>
    </div>
  );
};

export default ProductCalculator;
