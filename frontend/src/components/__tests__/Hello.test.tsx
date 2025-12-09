import { render, screen } from '@testing-library/react'
import Hello from '../Hello'

test('renders hello message', () => {
  render(<Hello name="Test" />)
  expect(screen.getByText(/Hello, Test/i)).toBeInTheDocument()
})
