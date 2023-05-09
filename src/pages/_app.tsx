import { ClerkProvider } from '@clerk/nextjs';
import { type AppType } from 'next/app';

import { api } from 'y/utils/api';

import 'y/styles/globals.css';
import { Toaster } from 'react-hot-toast';

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <ClerkProvider {...pageProps}>
      <Toaster position="bottom-center" />
      <Component {...pageProps} />
    </ClerkProvider>
  );
};

export default api.withTRPC(MyApp);
