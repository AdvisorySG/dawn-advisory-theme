import './jquery-global.js';

import InfiniteScroll from 'infinite-scroll';
import PhotoSwipe from 'photoswipe';
import PhotoSwipeUIDefault from 'photoswipe/dist/photoswipe-ui-default';
import elasticlunr from 'elasticlunr';
import fitvids from 'fitvids';
import 'lazysizes';

import Glide from '@glidejs/glide';

var body = $('body');
var timeout;
var st = 0;
var lastSt = 0;
var titleOffset = 0;
var contentOffset = 0;
var progress = $('.sticky-progress');

$(function () {
    subMenu();
    featured();
    partners();
    featuredBy();
    pagination();
    video();
    gallery();
    table();
    modal();
    search();
    burger();
});

$(window).on('scroll', function () {
    if (body.hasClass('post-template')) {
        if (timeout) {
            window.cancelAnimationFrame(timeout);
        }
        timeout = window.requestAnimationFrame(sticky);
    }
});

$(window).on('load', function () {
    if (body.hasClass('post-template')) {
        titleOffset = $('.single-title').offset().top;

        var content = $('.single-content');
        var contentHeight = content.height();
        contentOffset =
            content.offset().top + contentHeight - $(window).height() / 2;
    }
});

function sticky() {
    st = jQuery(window).scrollTop();

    if (titleOffset > 0 && contentOffset > 0) {
        if (st > lastSt) {
            if (st > titleOffset) {
                body.addClass('sticky-visible');
            }
        } else {
            if (st <= titleOffset) {
                body.removeClass('sticky-visible');
            }
        }
    }

    progress.css(
        'transform',
        'translate3d(' +
            (-100 + Math.min((st * 100) / contentOffset, 100)) +
            '%,0,0)'
    );

    lastSt = st;
}

function subMenu() {
    var mainNav = $('.main-nav');
    var separator = mainNav.find('.menu-item[href*="..."]');

    if (separator.length) {
        separator.nextAll('.menu-item').wrapAll('<div class="sub-menu" />');
        separator.replaceWith(
            '<button class="button-icon menu-item-button menu-item-more" aria-label="More"><svg class="icon"><use xlink:href="#dots-horizontal"></use></svg></button>'
        );

        var toggle = mainNav.find('.menu-item-more');
        var subMenu = $('.sub-menu');
        toggle.append(subMenu);

        toggle.on('click', function () {
            if (!subMenu.is(':visible')) {
                subMenu.show().addClass('animate__animated animate__bounceIn');
            } else {
                subMenu.addClass('animate__animated animate__zoomOut');
            }
        });

        subMenu.on('animationend', function (e) {
            subMenu.removeClass(
                'animate__animated animate__bounceIn animate__zoomOut'
            );
            if (e.originalEvent.animationName == 'zoomOut') {
                subMenu.hide();
            }
        });
    }
}

function featured() {
    if (body.find('.featured-feed').length === 0) {
        return;
    }

    var glideFeed = new Glide('.featured-feed', {
        type: 'carousel',
        autoplay: 3500,
        perView: 3,
        breakpoints: {
            768: {
                perView: 1,
            },
            992: {
                perView: 2,
            },
        },
    });
    glideFeed.mount();
}

function partners() {
    if (body.find('.partners-feed').length === 0) {
        return;
    }

    var glideFeed = new Glide('.partners-feed', {
        type: 'carousel',
        autoplay: 3500,
        perView: 4,
        breakpoints: {
            768: {
                perView: 2,
            },
        },
    });
    glideFeed.mount();
}

function featuredBy() {
    if (body.find('.featuredby-feed').length === 0) {
        return;
    }

    var glideFeed = new Glide('.featuredby-feed', {
        type: 'carousel',
        autoplay: 3500,
        perView: 4,
        breakpoints: {
            768: {
                perView: 2,
            },
        },
    });
    glideFeed.mount();
}

function pagination() {
    if (body.hasClass('paged-next')) {
        new InfiniteScroll('.post-feed', {
            append: '.feed-card',
            button: '.infinite-scroll-button',
            debug: false,
            hideNav: '.pagination',
            history: false,
            path: '.pagination .older-posts',
            scrollThreshold: false,
            status: '.infinite-scroll-status',
        });
    }
}

function video() {
    fitvids('.single-content');
}

function gallery() {
    var images = document.querySelectorAll('.kg-gallery-image img');
    images.forEach(function (image) {
        var container = image.closest('.kg-gallery-image');
        var width = image.attributes.width.value;
        var height = image.attributes.height.value;
        var ratio = width / height;
        container.style.flex = ratio + ' 1 0%';
    });

    pswp(
        '.kg-gallery-container',
        '.kg-gallery-image',
        '.kg-gallery-image',
        false,
        true
    );
}

function table() {
    if (body.hasClass('post-template') || body.hasClass('page-template')) {
        var tables = $('.single-content').find('.table');
        tables.each(function (_, table) {
            var labels = [];

            $(table)
                .find('thead th')
                .each(function (_, label) {
                    labels.push($(label).text());
                });

            $(table)
                .find('tr')
                .each(function (_, row) {
                    $(row)
                        .find('td')
                        .each(function (index, column) {
                            $(column).attr('data-label', labels[index]);
                        });
                });
        });
    }
}

function modal() {
    var modalOverlay = $('.modal-overlay');
    var modal = $('.modal');
    var modalInput = $('.modal-input');

    $('.js-modal').on('click', function (e) {
        e.preventDefault();
        modalOverlay.show().outerWidth();
        body.addClass('modal-opened');
        modalInput.focus();
    });

    $('.modal-close, .modal-overlay').on('click', function () {
        body.removeClass('modal-opened');
    });

    modal.on('click', function (e) {
        e.stopPropagation();
    });

    $(document).keyup(function (e) {
        if (e.keyCode === 27 && body.hasClass('modal-opened')) {
            body.removeClass('modal-opened');
        }
    });

    modalOverlay.on('transitionend', function () {
        if (!body.hasClass('modal-opened')) {
            modalOverlay.hide();
        }
    });

    modal.on('transitionend', function (e) {
        e.stopPropagation();
    });
}

function elasticSearch(query, callback) {
    var base_url = 'https://advisorysg.ent.ap-southeast-1.aws.found.io';
    var engine = 'ghost';
    var search_only_key = 'search-brya3eig6n5g9ybimkw3o9u3';

    var oReq = new XMLHttpRequest();
    var payload = { query: query }; //, 'page':{'size':5, 'current':1}};
    oReq.open(
        'POST',
        base_url + '/api/as/v1/engines/' + engine + '/search.json'
    ); //?'+encodeURI(JSON.stringify(payload)));
    oReq.addEventListener('load', callback);
    oReq.setRequestHeader('Content-Type', 'application/json');
    oReq.setRequestHeader('Authorization', 'Bearer ' + search_only_key);
    oReq.send(JSON.stringify(payload));
}
function search() {
    var searchInput = $('.search-input');
    var searchButton = $('.search-button');
    var searchResult = $('.search-result');
    var includeContent =
        typeof gh_search_content == 'undefined' || gh_search_content == true
            ? true
            : false;

    if (typeof gh_search_key == 'undefined' || gh_search_key == '') return;
    var url =
        siteUrl +
        '/ghost/api/v3/content/posts/?key=' +
        gh_search_key +
        '&limit=all&fields=id,title,url,updated_at,visibility&order=updated_at%20desc';
    url += includeContent ? '&formats=plaintext' : '';
    var indexDump = JSON.parse(localStorage.getItem('dawn_search_index'));
    var index;

    elasticlunr.clearStopWords();

    localStorage.removeItem('dawn_index');
    localStorage.removeItem('dawn_last');

    function update(data) {
        data.posts.forEach(function (post) {
            index.addDoc(post);
        });

        try {
            localStorage.setItem('dawn_search_index', JSON.stringify(index));
            localStorage.setItem('dawn_search_last', data.posts[0].updated_at);
        } catch (e) {
            console.error(
                'Your browser local storage is full. Update your search settings following the instruction at https://github.com/TryGhost/Dawn#disable-content-search'
            );
        }
    }

    if (!indexDump) {
        $.get(url, function (data) {
            if (data.posts.length > 0) {
                index = elasticlunr(function () {
                    this.addField('title');
                    if (includeContent) {
                        this.addField('plaintext');
                    }
                    this.setRef('id');
                });

                update(data);
            }
        });
    } else {
        index = elasticlunr.Index.load(indexDump);

        $.get(
            url +
                "&filter=updated_at:>'" +
                localStorage
                    .getItem('dawn_search_last')
                    .replace(/\..*/, '')
                    .replace(/T/, ' ') +
                "'",
            function (data) {
                if (data.posts.length > 0) {
                    update(data);
                }
            }
        );
    }

    searchInput.on('keyup', function (e) {
        elasticSearch(e.target.value, function () {
            var data = JSON.parse(this.responseText);
            var output = '';
            data.results.forEach(function (post) {
                output +=
                    '<div class="search-result-row">' +
                    '<a class="search-result-row-link" href="' +
                    post['url_path'].raw +
                    '">' +
                    post.title.raw +
                    '</a>' +
                    '</div>';
            });
            searchResult.html(output);
        });
    });
    /*
    searchInput.on('keyup', function (e) {
        var result = index.search(e.target.value, { expand: true });
        var output = '';

        result.forEach(function (post) {
            output +=
                '<div class="search-result-row">' +
                '<a class="search-result-row-link" href="' +
                post.doc.url +
                '">' +
                post.doc.title +
                '</a>' +
                '</div>';
        });

        searchResult.html(output);
        
        

        if (e.target.value.length > 0) {
            searchButton.addClass('search-button-clear');
        } else {
            searchButton.removeClass('search-button-clear');
        }
    });*/

    $('.search-form').on('submit', function (e) {
        e.preventDefault();
    });

    searchButton.on('click', function () {
        if ($(this).hasClass('search-button-clear')) {
            searchInput.val('').focus().keyup();
        }
    });
}

function burger() {
    $('.burger').on('click', function () {
        body.toggleClass('menu-opened');
    });
}

function pswp(container, element, trigger, caption, isGallery) {
    var parseThumbnailElements = function (el) {
        var items = [],
            gridEl,
            linkEl,
            item;

        $(el)
            .find(element)
            .each(function (i, v) {
                gridEl = $(v);
                linkEl = gridEl.find(trigger);

                item = {
                    src: isGallery
                        ? gridEl.find('img').attr('src')
                        : linkEl.attr('href'),
                    w: 0,
                    h: 0,
                };

                if (caption && gridEl.find(caption).length) {
                    item.title = gridEl.find(caption).html();
                }

                items.push(item);
            });

        return items;
    };

    var openPhotoSwipe = function (index, galleryElement) {
        var pswpElement = document.querySelectorAll('.pswp')[0],
            gallery,
            options,
            items;

        items = parseThumbnailElements(galleryElement);

        options = {
            closeOnScroll: false,
            history: false,
            index: index,
            shareEl: false,
            showAnimationDuration: 0,
            showHideOpacity: true,
        };

        gallery = new PhotoSwipe(
            pswpElement,
            PhotoSwipeUIDefault,
            items,
            options
        );
        gallery.listen('gettingData', function (index, item) {
            if (item.w < 1 || item.h < 1) {
                // unknown size
                var img = new Image();
                img.onload = function () {
                    // will get size after load
                    item.w = this.width; // set image width
                    item.h = this.height; // set image height
                    gallery.updateSize(true); // reinit Items
                };
                img.src = item.src; // let's download image
            }
        });
        gallery.init();
    };

    var onThumbnailsClick = function (e) {
        e.preventDefault();

        var index = $(e.target)
            .closest(container)
            .find(element)
            .index($(e.target).closest(element));
        var clickedGallery = $(e.target).closest(container);

        openPhotoSwipe(index, clickedGallery[0]);

        return false;
    };

    $(container).on('click', trigger, function (e) {
        onThumbnailsClick(e);
    });
}
