import { Head, Html, Main, NextScript } from 'next/document'
import { THEME_STORAGE_KEY } from '../lib/theme'

const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light'}else{document.documentElement.dataset.theme='dark';document.documentElement.style.colorScheme='dark'}}catch(e){}})();`

export default function Document() {
  return (
    <Html lang="en" data-theme="dark">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
