# dawn-advisory-theme ![Deploy Theme](https://github.com/AdvisorySG/dawn-advisory-theme/workflows/Deploy%20Theme/badge.svg)

A highly functional theme that adapts to the reader's preferences. Let them read, search, subscribe, navigate, and more with ease. Completely free and fully responsive, released under the MIT license.

This theme was originally based off [TryGhost/Dawn](https://github.com/TryGhost/Dawn).

&nbsp;

# Instructions

1. [Setup a local Ghost instance](https://ghost.org/docs/install/local/).
2. Ensure you have [Node v16](https://nodejs.org/) installed.
3. From the root directory, execute the `zip` Gulp task:

```bash
# Install dependencies
npm install

# Package the theme into a zip archive
npm run zip
```

4. Upload the zipfile at `dist/dawn-advisory-theme.zip` onto your local Ghost instance at `Settings > Theme > Change theme > Upload theme`.

Optionally, if you have access to the [Admin panel of Advisory](https://beta.advisory.sg/ghost/), you can go to `Settings > Labs > Migration Options > Export your content` in order to export the posts and settings used for the actual website as a JSON file. This file can be imported into your local instance of Ghost, at `Settings > Labs > Migration Options > Import content`. Take note that this will not remove existing posts/pages.

# Dropdown Menu

The theme looks for a menu item with three dots (`...`) in its URL, and uses that as a dropdown menu toggle. All menu items after the toggle will be added to the dropdown list automatically.

| Label      | URL                       |
| ---------- | ------------------------- |
| More links | https://example.com/...   |
| Sub-1      | https://example.com/sub-1 |
| Sub-2      | https://example.com/sub-2 |

# Development

Styles are compiled using Gulp/PostCSS to polyfill future CSS spec. You'll need [Node](https://nodejs.org/) and [Gulp](https://gulpjs.com) installed globally. After that, from the theme's root directory:

```bash
# Install
npm

# Run build & watch for changes
npm run dev
```

Now you can edit `/assets/css/` files, which will be compiled to `/assets/built/` automatically.

## Speedy Development

To speed up development with a local instance of Ghost, you may use an alternative procedure to directly place the theme directory in the `content/themes/` directory of Ghost.

Firstly, use the earlier mentioned process with `npm run zip` and upload the theme. This is important, as **Ghost will not recognise your new theme directory if you do not perform this import first**. In the `content/themes/` directory from the root directory of your Ghost installation, you should see the `dawn-advisory-theme` directory. (**Do not perform this step by importing a zipfile directly from the GitHub Actions builds; as the zipfile has an appended hash, Ghost will not recognise your new `dawn-advisory-theme` directory. Make sure to rename the zipfile to `dawn-advisory-theme.zip` before importing.**)

Once you have verified that the `content/themes/dawn-advisory-theme/` directory is in place and Ghost recognises the directory as a theme, remove the `dawn-advisory-theme` directory and clone this repository into the `content/themes/` directory under the same directory name `dawn-advisory-theme`. (Alternatively, if you use an Unix-based system, you may create a symbolic link instead. Windows users may wish to create a shortcut from the Ghost directory instead.)

Finally, run `npm run dev` in the `content/themes/dawn-advisory-theme/` directory and refresh the Ghost admin panel. You should see the correct theme appear. Upon making changes to theme files, `npm run dev` should build the changed files and the changes should be reflected upon refresh.

This method is not officially supported by Ghost and might break any time (though the theme handling logic is unlikely to be modified in the foreseeable future). Take note that if you add new post templates, you may need to restart Ghost manually for the changes to take place in the Admin panel.

## Folder Structure

This purpose of this section is to help developers to gain a more comprehensive understanding regarding the different components that are needed for ghost development.

-   Partials
    -   The Partial folder contains reusable template components that can be used by other templates. These reusable template components serve to simplify the development process as we can reuse similar template components without having to code them from scrtch all over again.
-   Handlebar Files (`.hbs`)
    -   Handlebars can be though of as a **language** that is used to construct template components. There are various other similar templating languages, some that you might be familiar with (for eg. `jsx` files (in React) or `html` files).
    -   Ghost themes uses Handlebars for their templating language, and also includes some additional features such as layout and partials.
    -   Handlebar files can also be easily customized through modifications of the custom theme settings in the `package.json` file placed at the root directory of the project.
-   Static Folder
    -   The static Folder contains files that do not change when the application is running. As such, they are not required to be rendered dynamically.
    -   Some examples of what can be stored in the static folder include:
        -   Scripts (`.js)
        -   Style Sheets (`.css`)
        -   Images (profile pictures, header images... )
-   Build process
    -   What is the difference between `npm run dev` and `npm run start`?
        -   `npm run dev` is used to run or view the application worked on while in development mode. When developing new features, this would be the more appropriate build command to use - as it renders changes onto your local build without having you to restart the server.
        -   `npm run start` is used to run the application in production mode. Changes made to the code base will not be reflected on the website when production mode is used.

## Key Technologies that you might want to read up on

-   TailWind CSS (https://tailwindcss.com/docs/installation)
-   Handlebars (https://handlebarsjs.com/guide/)
-   Javascript (https://developer.mozilla.org/en-US/docs/Web/JavaScript)

## `routes.yaml` Setup

For the homepage and separate [Stories](https://beta.advisory.sg/stories) page to be rendered correctly, it is necessary to upload a custom `routes.yaml` file onto Ghost. Please refer to [the instructions here](https://ghost.org/docs/themes/routing/) for more details.

**Note**: The `routes.yaml` file supplied in the repository is not automatically deployed onto the main website.

# PostCSS Features Used

-   Autoprefixer - Don't worry about writing browser prefixes of any kind, it's all done automatically with support for the latest 2 major versions of every browser.

# Copyright & License

Copyright (c) 2013-2021 Ghost Foundation, 2021-2022 Advisory Singapore - Released under the [MIT license](LICENSE).
