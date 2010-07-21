/*************************************************************************/
/* The Dopp-Down menu: A simple, small, flexible autocomplete widget built on
 * jQuery.
 * 
 * Now with extra WhizBang! (TM)
 *
 * Copyright 2010 Phil Darnowsky
 * After an idea by Sarah Dopp
 *  
 * Please note that this is alpha software. It's hard to see how it could hurt
 * anything, but still, you use it at your own risk.
 *
 *
 * USAGE:
 *
 * dopp_down_menu(
 *   direct_entry_field_selector, 
 *   autosuggest_div_selector,
 *   suggestion_lookup_url, 
 *   options
 * ) 
 *
 *
 * MANDATORY PARAMETERS:
 *
 * direct_entry_field_selector is a selector or jQuery object representing
 *   the element (usually a text field) that the autosuggestor will watch and
 *   use the value of the make suggestion queries.
 *
 * autosuggest_div_selector is a selector or jQuery object that will be
 *   populated with suggestions.
 *
 * suggestion_lookup_url is the search URL that will be called (via GET) to
 *   look up suggestions. See EXPECTED RESPONSE below for what the response 
 *   is expected to look like.
 *
 * 
 * OPTIONAL PARAMETERS:
 *
 * By passing an optional JavaScript object as the fourth parameter to
 * dopp_down_menu, you can customize the functionality of the widget.
 *
 * suggestion_link_class is the class that suggestion links will be generated
 *   with. Default is "dopp_down_menu_suggestions".
 *
 * highlighted_link_class is the class that the currently highlighted
 *   suggestion link will have. Default is "dopp_down_menu_highlighted"
 *
 * popular_choice_div_selector and popular_choice_url, if both are set, will
 *   call the specified URL once at page load and populate the specified
 *   element with "popular" links.
 *
 * minimum_lookup_string_length is the minimum number of characters that have
 *   to be in the watched field before we'll query the server for suggestions.
 *   Default is 3.
 *
 * autosuggest_timeout is the minimum amount of time (in milliseconds) that 
 *   will pass between queries to the server for suggestions. Default is 250
 *   milliseconds, i.e. 1/4 second.
 *
 * search_query_param is the query parameter that will get the value of the
 *   suggestion field when querying the server. For example, if 
 *   suggestion_lookup_url is "http://example.com/autosuggest", and
 *   search_query_param is "find_suggestion", and the query field contains
 *   "blurg", then the URL that we'll query for suggestions is
 *     http://example.com/autosuggest?find_suggestion=blurg
 *   Default is "search".
 *
 * name_field and popularity_field are the fields in a suggestion object where
 *   we expect to find the text of the suggestion and a "popularity" value
 *   (what "popularity" means in your context is up to you). Defaults are
 *   name and popularity respectively.
 *
 * show_popularity_in_suggestions and show_popularity_in_popular_choices are
 *   flags that indicate whether suggestion/popular links should show their
 *   popularity value after their name, e.g., "blurg (7413)" for a suggestion
 *   "blurg" with popularity of 7413. Both default to false.
 *
 * suggestion_link_pre_insert_hook and suggestion_link_post_insert_hook are
 *   called just before and just after a suggestion link is added to the page
 *   (either in the suggestion or "popular choices" element). They get passed
 *   the link being added and the div being added to. This is a good chance to
 *   add a little HTML before or after a link.
 *
 * pre_link_creation_hook gets passed each JSON object received from the
 *   server before we build a link out of it. You can use this to massage or
 *   preprocess the data if you'd rather not change the backend.
 *
 *
 * EXPECTED RESPONSE
 *
 * By default, dopp_down_menu expects suggestions/popular choices to be
 * returned from the server as a list of JSON objects with "name" and (if 
 * you're displaying the popularity counts) "popularity" fields. You can use
 * pre_link_creation_hook (detailed above) to alter each suggestion
 * arbitrarily.
 *
 * For example, if you write the backend in Rails, and you've got a SearchTerm
 * model with name and popularity fields, the default implementation of
 * to_json will give you something like this:
 *
 *   "'search_term': {'name': 'blurg', 'popularity': 7314}"
 *
 * So you would want pre_link_creation hook to strip off that search_term
 * wrapper like so:
 *
 *   pre_link_creation_hook: function(suggestion) {suggestion.search_term}
 *
 *
 * LICENSE
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *************************************************************************/

function dopp_down_menu(
  direct_entry_field_selector, 
  autosuggest_div_selector,
  suggestion_lookup_url, 
  options) 
{
  var direct_entry_field_dirty = false;

  var staging_div;
  var staging_div_id = 'dopp_down_menu_staging_' + Math.floor(Math.random(1000000) * 1000000);
  $('body').append('<div id="' + staging_div_id + '" style="display:none"></div>');
  staging_div = $('#' + staging_div_id);

  var direct_entry_field = $(direct_entry_field_selector);
  var autosuggest_div = $(autosuggest_div_selector);

  var _options = options || {};

  var suggestion_link_class = _options.suggestion_link_class || 'dopp_down_menu_suggestions';
  var highlighted_link_class = _options.highlighted_link_class || 'dopp_down_menu_highlighted';

  var popular_choice_div_selector = _options.popular_choice_div_selector;
  var popular_choice_url = _options.popular_choice_url;
  if(popular_choice_div_selector && popular_choice_url) {
    popular_choice_div = $(popular_choice_div_selector);
  } else {
    popular_choice_div = null;
  }

  var suggestion_link_pre_insert_hook = _options.suggestion_link_pre_insert_hook || function() {};
  var suggestion_link_post_insert_hook = _options.suggestion_link_post_insert_hook || function() {};
  var pre_link_creation_hook = _options.pre_link_creation_hook || function(suggestion) {return(suggestion)};

  var minimum_lookup_string_length = _options.minimum_lookup_string_length || 3;

  var search_query_param = _options.search_query_param || 'search';

  var autosuggest_timeout = _options.autosuggest_timeout || 250;

  var name_field = _options.name_field || 'name';
  var popularity_field = _options.popularity_field || 'popularity';

  var show_popularity_in_suggestions = _options.show_popularity_in_suggestions || false;
  var show_popularity_in_popular_choices = _options.show_popularity_in_popular_choices || false;

  var dopp_down_menu_closure = function() {
    var uparrow_code = 38;
    var downarrow_code = 40;

    var last_key_down = null;

    function last(array) {
      return array.reverse()[0];
    };

    function csv_tags(string) {
      var trimmed = string.trim();
      if(trimmed.length == 0) {
        return([]);
      }

      var raw_tags = string.trim().split(/,/);
      return $.map(raw_tags, function(str) {return str.trim()});
    };

    function set_last_csv_tag(new_last_tag) {
      var current_tags = csv_tags(direct_entry_field.val());
      var new_tags;

      if(current_tags.length == 0) {
        new_tags = [new_last_tag];
      } else {
        new_tags = current_tags;
        new_tags.splice(-1, 1, new_last_tag);
      }

      var new_tag_text = new_tags.join(', ') + ', ';
      direct_entry_field.val(new_tag_text).focus();
      autosuggest_div.hide();
    };

    function create_suggestion_link(suggestion, options) {
      var _options = options || {};

      var processed_suggestion = pre_link_creation_hook(suggestion);

      var suggestion_name = processed_suggestion[name_field];
      var suggestion_popularity = processed_suggestion[popularity_field];

      var link_text = suggestion_name;
      if(_options.show_popularity) {
        link_text = link_text + ' (' + suggestion_popularity + ')';
      }

      result_html = [
        '<a href="#" class="',
        suggestion_link_class,
        '">',
        link_text,
        '</a>'
      ].join('');

      staging_div.append(result_html);
      result = staging_div.children(':last-child');
      result.click(function() {set_last_csv_tag(suggestion_name)});
      return(result);
    };

    function create_suggestion_links_from_suggestions(suggestions, options) {
      var suggestion_names;
      var suggestion_links;

      suggestion_links = $.map(suggestions, function(suggestion) {return create_suggestion_link(suggestion, options)});
      return(suggestion_links);
    };

    function clear_suggestion_highlighting() {
      $('a.' + suggestion_link_class).removeClass(highlighted_link_class);
    };

    function highlight_suggestion(suggestion_index) {
      clear_suggestion_highlighting();
      new_highlighted_suggestion = $(autosuggest_div.children('a.' + suggestion_link_class)[suggestion_index]);
      new_highlighted_suggestion.addClass(highlighted_link_class).focus();
      scroll_to_element(new_highlighted_suggestion);
    };

    function highlight_first_suggestion() {
      highlight_suggestion(0);
    };

    function highlight_last_suggestion() {
      highlight_suggestion(last_suggestion_index());
    };

    function highlighted_suggestion_index() {
      var highlighted_suggestion = $('a.' + highlighted_link_class);

      if(highlighted_suggestion) {
        return(highlighted_suggestion.prevAll('a.' + suggestion_link_class).length);
      } else {
        return(undefined);
      }
    };

    function last_suggestion_index() {
      return(autosuggest_div.children('a.' + suggestion_link_class).length - 1);
    };

    function scroll_to_element(element) {
      var element_top = element.offset().top;
      $(document).scrollTop(element_top - element.height());
    };

    function move_off_of_direct_entry_field() {
      if(last_key_down == downarrow_code) {
        highlight_first_suggestion();
      } else {
        highlight_last_suggestion();
      }
    };

    function return_to_direct_entry_field() {
      clear_suggestion_highlighting();
      direct_entry_field.focus();
      scroll_to_element(direct_entry_field);
    };

    function move_up_within_suggestion_list() {
      var currently_highlighted_index = highlighted_suggestion_index();

      if(currently_highlighted_index == 0) {
        return_to_direct_entry_field();
      } else {
        highlight_suggestion(currently_highlighted_index - 1);
      }
    };

    function move_down_within_suggestion_list() {
      var currently_highlighted_index = highlighted_suggestion_index();

      if(currently_highlighted_index == last_suggestion_index()) {
        return_to_direct_entry_field();
      } else {
        highlight_suggestion(currently_highlighted_index + 1);
      }
    };

    function move_within_suggestion_list() {
      if(last_key_down == downarrow_code) {
        move_down_within_suggestion_list();
      } else if (last_key_down == uparrow_code) {
        move_up_within_suggestion_list();
      }
    };

    function remember_last_keydown(keycode) {
      last_key_down = keycode;
    };

    function populate_div_with_suggestion_links(div_to_populate, suggestion_links) {
      div_to_populate.empty();

      $.each(
        suggestion_links, 
        function(_, suggestion_link) {
          suggestion_link_pre_insert_hook(suggestion_link, div_to_populate);
          div_to_populate.append(suggestion_link);
          suggestion_link_post_insert_hook(suggestion_link, div_to_populate);
        }
      );

      return(div_to_populate);
    };

    function populate_popular_div(data) {
      var suggestion_links = create_suggestion_links_from_suggestions(data, {show_popularity: show_popularity_in_popular_choices});
      populate_div_with_suggestion_links(popular_choice_div, suggestion_links);
    };

    function populate_suggestion_div(suggestions) {
      suggestion_links = create_suggestion_links_from_suggestions(suggestions, {show_popularity: show_popularity_in_suggestions});
      populate_div_with_suggestion_links(autosuggest_div, suggestion_links).show();
    };

    if(popular_choice_div) {
      $.get(
        popular_choice_url,
        {},
        populate_popular_div
      );
    }

    direct_entry_field.
      keypress(function(e) {
        if(e.which != 0) {
          direct_entry_field_dirty = true;
        } else {
          move_off_of_direct_entry_field();
        }
      }).
      keydown(function(e) {remember_last_keydown(e.which)});

    autosuggest_div.
      keydown(function(e) {remember_last_keydown(e.which)}).
      keypress(move_within_suggestion_list);

    setInterval(
      function() {
        if(direct_entry_field_dirty) {
          var last_entry = last(csv_tags(direct_entry_field.val()));

          if(last_entry && last_entry.length >= minimum_lookup_string_length) {
            query_params = {};
            query_params[search_query_param] = last_entry;

            $.get(
              suggestion_lookup_url,
              query_params,
              populate_suggestion_div
            );
          } else {
            autosuggest_div.hide();
          }
        }

        direct_entry_field_dirty = false;
      },
      autosuggest_timeout
    );
  };

  dopp_down_menu_closure();
}

