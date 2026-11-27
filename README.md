# MotifPass landing page

Early preview of MotifPass, a concept product for designers who sell the same artwork on several marketplaces.

This is a static page. Paid-plan buttons go to Stripe **test-mode** checkout. There are no real charges.

Intended GitHub Pages URL (not live yet):

https://hizam56.github.io/motifpass-landing/

## Enable GitHub Pages

The deploy workflow could not turn Pages on by itself. The Actions log was:

> Create Pages site failed. Error: Resource not accessible by integration —
> https://docs.github.com/rest/pages/pages#create-a-apiname-pages-site

To publish the site, a repo owner should:

1. Open https://github.com/hizam56/motifpass-landing/settings/pages
2. Under **Build and deployment → Source**, choose **Deploy from a branch**
3. Set the branch to `main` and the folder to `/ (root)`, then save

The page should go live at the URL above within a minute or two. Alternatively, choose **GitHub Actions** as the source and re-run the failed **Deploy to GitHub Pages** workflow.
