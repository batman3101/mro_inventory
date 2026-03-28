import { RouterProvider } from 'react-router-dom';
import AntConfigProvider from './AntConfigProvider';
import router from './router';
import 'antd/dist/reset.css';

function App() {
  return (
    <AntConfigProvider>
      <RouterProvider router={router} />
    </AntConfigProvider>
  );
}

export default App;
