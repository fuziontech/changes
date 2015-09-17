import React, { PropTypes } from 'react';

import APINotLoaded from 'es6!display/not_loaded';
import ChangesLinks from 'es6!display/changes/links';
import ChangesUI from 'es6!display/changes/ui';
import SectionHeader from 'es6!display/section_header';
import { ChangesPage, APINotLoadedPage } from 'es6!display/page_chrome';
import { Grid } from 'es6!display/grid';
import { ManyBuildsStatus, get_runnable_condition } from 'es6!display/changes/builds';
import { TimeText } from 'es6!display/time';

import * as api from 'es6!server/api';

import * as utils from 'es6!utils/utils';
import custom_content_hook from 'es6!utils/custom_content';

var HomePage = React.createClass({

  getInitialState: function() {
    return {
      commits: null,
      diffs: null
    }
  },

  componentDidMount: function() {
    var author = this.props.author || 'me';

    api.fetch(this, {
      diffs: `/api/0/authors/${author}/diffs/`,
      commits: `/api/0/authors/${author}/commits/?per_page=20`,
      projects: '/api/0/projects/' // no fetch_extra
    });
  },


  render: function() {
    // NOTE: so right now, this page still basically works even when
    // phabricator is down. Keep it that way.

    // I want to display just a single loading indicator until we have content
    // to show
    if (!api.isLoaded(this.state.commits)) {
      // special rendering for not logged in
      if (api.isError(this.state.commits) &&
          this.state.commits.getStatusCode() === '401') {
        return this.renderNotLoggedIn();
      }

      return <APINotLoadedPage
        highlight="My Changes"
        calls={this.state.commits}
      />;
    }

    // hack to use homepage as user page
    // TODO: not this
    var header_markup = null;
    if (this.props.author) {
      var author_info = this.state.commits.getReturnedData()[0].builds[0].author;
      header_markup = <div style={{paddingBottom: 30, paddingTop: 10}}>
        Diffs and Commits by {author_info.name}.
      </div>;
    }

    var projects = null;
    if (!this.props.author) {
      projects = <div className="marginTopL">
        <Projects projects={this.state.projects} />
      </div>;
    }

    return <ChangesPage highlight="My Changes">
      {header_markup}
      <div>
        <Diffs
          diffs={this.state.diffs}
          author={this.props.author}
        />
        <Commits
          commits={this.state.commits}
          author={this.props.author}
        />
      </div>
      {projects}
    </ChangesPage>;
  },

  renderNotLoggedIn: function() {
    var current_location = encodeURIComponent(window.location.href);
    var login_href = '/auth/login/?orig_url=' + current_location;

    var login_markup = [
      <a href={login_href}>
        Log in
      </a>,
      " to see your recent diffs and commits."
    ];

    var custom_login_image = custom_content_hook('customLoginImage');
    if (custom_login_image) {
      var image_href = '/v2/custom_image/' + custom_login_image;
      login_markup = <center style={{ marginTop: 24, display: "block" }}>
        <img
          className="block"
          src={image_href}
          style={{ width: "30%" }}
        />
        <div style={{fontSize: 18}}>{login_markup}</div>
      </center>;
    }

    return <ChangesPage highlight="My Changes">
      <div className="marginBottomL">
        {login_markup}
      </div>
      <Projects projects={this.state.projects} />
    </ChangesPage>;
  }
});

// Render list of the user's diffs currently in review / uncommitted
var Diffs = React.createClass({

  propTypes: {
    // diffs authored by the user (and associated builds)
    diffs: PropTypes.array,

    // author = null if viewing home page, otherwise the author
    author: PropTypes.string,
  },

  getInitialState: function() {
    return {};
  },

  render: function() {
    if (!api.isLoaded(this.props.diffs)) {
      return <APINotLoaded calls={this.props.diffs} />;
    }

    var diffs = this.props.diffs.getReturnedData();

    var grid_data = _.map(diffs, d => {
      var ident = "D" + d.id;

      var latest_builds = null;
      if (d.builds.length > 0) {
        // TODO: nit, but if there are no builds, let's render an invisible
        // clickable widget

        latest_builds = <ManyBuildsStatus builds={d.builds} />;
      }

      return [
        latest_builds,
        <a className="external" href={d['uri']} target="_blank">{ident}</a>,
        <span className={this.getStatusColor(d['statusName'])}>
          {d['statusName']}
        </span>,
        d['title'],
        <TimeText time={d['dateModified']} format="X" />
      ];
    });

    var cellClasses = ['nowrap buildWidgetCell', 'nowrap', 'nowrap', 'wide', 'nowrap'];
    var headers = [
      'Build(s)',
      'Diff',
      'Status',
      'Name',
      'Updated'
    ];

    var header_text = !this.props.author ?  'My Diffs' : 'Diffs';
    return <div className="paddingBottomM">
      <SectionHeader>{header_text}</SectionHeader>
      <Grid
        colnum={5}
        data={grid_data}
        cellClasses={cellClasses}
        headers={headers}
      />
    </div>;
  },

  getStatusColor: function(status) {
    var color_map = {
      'Needs Review': 'bluishGray',
      'Needs Revision': 'red',
      'Changes Planned': 'red',
      'Accepted': 'green',
    };
    return color_map[status] || '';
  }
});

// List of user's recent commits
var Commits = React.createClass({

  propTypes: {
    // commits authored by the user (and associated builds)
    commits: PropTypes.object,

    // author = null if viewing home page, otherwise the author
    author: PropTypes.string,
  },

  getInitialState: function() {
    return {};
  },

  render: function() {
    if (!api.isLoaded(this.props.commits)) {
      return <APINotLoaded calls={this.props.commits} />;
    }

    var commits = this.props.commits.getReturnedData();

    if (commits.length === 0) {
      return <div>I don{"'"}t see any commits!</div>;
    }

    var grid_data = [];
    commits.forEach(c => {
      // Render links to the projects that ran builds (for user convenience..)
      var project_links = _.chain(c.builds)
        .map(b => b.project)
        .compact()
        .uniq(p => p.slug)
        .sortBy(p => p.name)
        .map(p => <div>{ChangesLinks.project(p)}</div>)
        .flatten()
        .value();

      grid_data.push(
        [
          <ManyBuildsStatus builds={c.builds} />,
          ChangesLinks.phabCommit(c.revision),
          project_links,
          utils.truncate(utils.first_line(c.revision.message)),
          <TimeText time={c.revision.dateCommitted} />
        ]
      );
    });

    var cellClasses = ['nowrap buildWidgetCell', 'nowrap', 'nowrap', 'wide', 'nowrap'];
    var headers = [
      'Last Build',
      'Commit',
      'Project(s)',
      'Name',
      'Committed'
    ];

    // custom content link for a tool to show whether commits have been
    // pushed to prod
    var is_it_out_markup = null;

    var is_it_out_link = custom_content_hook('isItOutHref');
    if (is_it_out_link && !this.props.author) {
      is_it_out_markup = <div className="darkGray marginTopM">
        Check to see if your commit is live in production:{" "}
        <a className="external" href={is_it_out_link} target="_blank">is it out?</a>
        {" "}
      </div>;
    }

    var header_text = !this.props.author ?
      'My Commits' : 'Commits';

    // TODO: this doesn't actually show other people's builds :/
    var builds_sentence = !this.props.author ?
      'See all of your ' : 'See all ';
    var buildsHref = `/v2/author_builds/${this.props.author || 'me'}`;

    return <div className="marginTopL">
      <SectionHeader>{header_text}</SectionHeader>
      <Grid
        colnum={5}
        data={grid_data}
        cellClasses={cellClasses}
        headers={headers}
      />
      <div className="darkGray marginTopM">
        {builds_sentence}<a href={buildsHref}>recent builds</a>{"."}
      </div>
      {is_it_out_markup}
    </div>;
  }
});

// List of projects. Color indicates if the latest build is green or red
var Projects = React.createClass({
  propTypes: {
    projects: PropTypes.object,
  },

  render: function() {
    var projects_api = this.props.projects;

    if (!api.isLoaded(projects_api)) {
      return <APINotLoaded calls={projects} />;
    }

    var projects = projects_api.getReturnedData();

    var project_entries = _.compact(_.map(projects, p => {
      var color_cls = '';
      if (p.lastBuild) {
        // ignore projects over a week old
        if (ChangesUI.projectIsStale(p.lastBuild)) {
          return null;
        }

        switch (get_runnable_condition(p.lastBuild)) {
          case 'passed':
            color_cls = 'green';
            break;
          case 'failed':
          case 'nothing':
            color_cls = 'red';
            break;
        }
      }

      return <a className={color_cls} href={ChangesLinks.projectHref(p)}>
        {p.name}
      </a>;
    }));

    // render names in 3 columns
    var num_per_column = Math.ceil(project_entries.length / 3);
    var column1 = project_entries.slice(0, num_per_column);
    var column2 = project_entries.slice(num_per_column, num_per_column * 2)
    var column3 = project_entries.slice(num_per_column * 2)
    var zipped = _.zip(column1, column2, column3);

    var project_rows = _.map(zipped, items => {
      var [v1, v2, v3] = items;
      return <tr>
        <td><span style={{ marginRight: 30 }}>{v1}</span></td>
        <td><span style={{ marginRight: 30 }}>{v2}</span></td>
        <td>{v3}</td>
      </tr>
    });
    var project_table = <table className="invisibleTable">{project_rows}</table>;

    return <div>
      <SectionHeader>Projects</SectionHeader>
      {project_table}
      <div className="darkGray marginTopM">
        Projects that haven{"'"}t run a build in the last week
        are not shown. See all on the{" "}
        <a href="/v2/projects/">Projects page</a>
      </div>
    </div>;
  }
});

export default HomePage;
