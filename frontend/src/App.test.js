import { render, screen } from '@testing-library/react';
import App from './App';
import { api } from './api/api';

jest.mock('./api/api', () => ({ api: jest.fn() }));

test('shows products from the store API', async () => {
  localStorage.removeItem('northstar-token');
  api.mockImplementation((path) => {
    if (path === '/products') return Promise.resolve([{
      _id: 'product-1',
      name: 'Studio Headphones',
      price: 129,
      stock: 8,
      image: '',
      description: 'Wireless sound',
      categoryId: { _id: 'audio', name: 'Audio' },
    }]);
    if (path === '/categories') return Promise.resolve([{ _id: 'audio', name: 'Audio' }]);
    return Promise.resolve([]);
  });

  render(<App />);

  expect(await screen.findByText('Studio Headphones')).toBeInTheDocument();
  expect(screen.getByText('Everything')).toBeInTheDocument();
});
