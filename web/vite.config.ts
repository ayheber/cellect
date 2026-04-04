import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change '/cellect/' to match your GitHub repository name.
// For example, if your repo is github.com/yourname/my-repo, set base: '/my-repo/'
// For a user/org site (yourname.github.io), set base: '/'
export default defineConfig({
  plugins: [react()],
  base: '/cellect/',
})
