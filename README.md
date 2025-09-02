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

For new developers, please ask Tech Management for the posts and settings to be exported, and to pass you the output JSON file.
This file can be imported into your local instance of Ghost, at `Settings > Labs > Migration Options > Import content`. Take note that this will not remove existing posts/pages.

Optionally, if you have access to the [Admin panel of Advisory](https://beta.advisory.sg/ghost/), you can go to `Settings > Labs > Migration Options > Export your content` in order to export the posts and settings used for the actual website as a JSON file. 

Furthermore, also make sure to setup `routes.yaml` as explained further down below

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

## `routes.yaml` Setup

For the homepage and separate [Stories](https://beta.advisory.sg/stories) page to be rendered correctly, it is necessary to upload a custom `routes.yaml` file onto Ghost. Please refer to [the instructions here](https://ghost.org/docs/themes/routing/) for more details.

**Note**: The `routes.yaml` file supplied in the repository is not automatically deployed onto the main website.

# PostCSS Features Used

- Autoprefixer - Don't worry about writing browser prefixes of any kind, it's all done automatically with support for the latest 2 major versions of every browser.

# Copyright & License

Copyright (c) 2013-2021 Ghost Foundation, 2021-2022 Advisory Singapore - Released under the [MIT license](LICENSE).
