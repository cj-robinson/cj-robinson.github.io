var ghpages = require('gh-pages');

ghpages.publish(
    'public', // path to public directory
    {
        branch: 'gh-pages',
        repo: 'https://github.com/cj-robinson', // Update to point to your repository  
        user: {
            name: 'CJ Robinson', // update to use your name
            email: 'cjcjcj777@gmail.com' // Update to use your email
        }
    },
    () => {
        console.log('Deploy Complete!')
    }
)