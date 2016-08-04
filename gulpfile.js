'use strict'; // eslint-disable-line

const path = require('path');

const gulp = require('gulp');
const sass = require('gulp-sass');
const cleancss = require('gulp-clean-css');
const concat = require('gulp-concat');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const eslint = require('gulp-eslint');
const gutil = require('gulp-util');
const uglify = require('gulp-uglify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const browserify = require('browserify');
const watchify = require('watchify');
const babelify = require('babelify');
const del = require('del');

const dirs = {
  src: {
    style: 'frontend/source/sass/',
    scripts: 'frontend/source/js/',
  },
  dest: {
    style: {
      built: 'frontend/static/frontend/built/style',
    },
    scripts: {
      // Scripts (vendor libs) common to CALC 1 and 2
      common: 'frontend/static/frontend/built/js/common',
      // CALC 1.0 scripts
      dataExplorer: 'frontend/static/frontend/built/js/data-explorer',
      // CALC 2.0 Data Capture scripts
      dataCapture: 'frontend/static/frontend/built/js/data-capture',
      // CALC 2.0 Tests
      tests: 'frontend/static/frontend/built/js/tests',
    },
  },
};

const paths = {
  sass: '**/*.scss',
  js: '**/*.js',
  dataCaptureEntry: 'data-capture/index.js',
  dataCaptureOutfile: 'index.min.js',
  testEntry: 'tests/index.js',
  testOutfile: 'index.min.js',
};

const bundles = {
  common: {
    base: [
      'vendor/d3.v3.min.js',
      'vendor/jquery.min.js',
      'vendor/query.xdomainrequest.min.js',
      'vendor/formdb.min.js',
      'common/hourglass.js',
      'vendor/jquery.tooltipster.js',
      'vendor/jquery.nouislider.all.min.js',
    ],
  },
  dataExplorer: {
    index: [
      'vendor/rgbcolor.js',
      'vendor/StackBlur.js',
      'vendor/canvg.js',
      'vendor/canvas-toBlob.js',
      'vendor/FileSaver.js',
      'vendor/jquery.auto-complete.min.js',
      'data-explorer/index.js',
    ],
  },
};

const isInDocker = ('DDM_IS_RUNNING_IN_DOCKER' in process.env);

// default task
// running `gulp` will default to watching and dist'ing files
gulp.task('default', ['watch']);

// production build task
// will need to run before collectstatic
// `npm run gulp -- build` or `gulp run build` if gulp-cli is installed globally
gulp.task('build', ['sass', 'js']);

// watch files for changes
gulp.task('watch', ['set-watching', 'sass', 'js'], () => {
  gulp.watch(path.join(dirs.src.style, paths.sass), ['sass']);

  // js:data-capture sets up its own watch handling (via watchify)
  // so we don't want to re-trigger it here, ref #437
  gulp.watch(path.join(dirs.src.scripts, paths.js), ['lint', 'js:legacy']);
});

gulp.task('clean', () => {
  function getPaths(obj) {
    return Object.keys(obj).map((k) => path.join(obj[k], '**/*'));
  }

  const styleDirs = getPaths(dirs.dest.style);
  const scriptDirs = getPaths(dirs.dest.scripts);

  del([].concat(styleDirs, scriptDirs));
});

// compile SASS sources
gulp.task('sass', () => gulp.src(path.join(dirs.src.style, paths.sass))
  .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(rename({ suffix: '.min' }))
    .pipe(cleancss())
  .pipe(sourcemaps.write('./'))
  .pipe(gulp.dest(dirs.dest.style.built))
);

// Compile and lint JavaScript sources
gulp.task('js', ['lint', 'js:data-capture', 'js:tests', 'js:legacy']);

gulp.task('js:legacy', ['js:data-explorer:index', 'js:common:base']);

function concatAndMapSources(name, sources, dest) {
  return gulp.src(sources)
    .pipe(sourcemaps.init())
      .pipe(concat(name))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(dest));
}

gulp.task('js:data-explorer:index', () => concatAndMapSources(
    'index.min.js',
    bundles.dataExplorer.index.map((p) => dirs.src.scripts + p),
    dirs.dest.scripts.dataExplorer
  )
);

gulp.task('js:common:base', () => concatAndMapSources(
    'base.min.js',
    bundles.common.base.map((p) => dirs.src.scripts + p),
    dirs.dest.scripts.common
  )
);

// boolean flag to indicate to watchify/browserify that it should set up
// its rebundling
let isWatching = false;
gulp.task('set-watching', () => {
  isWatching = true;
  return;
});

function browserifyBundle(entryPath, outputPath, outputFile) {
  // ref: https://gist.github.com/danharper/3ca2273125f500429945
  let bundler = browserify(entryPath, { debug: true })
    .transform(babelify.configure({ presets: ['es2015'] }));

  if (isWatching) {
    bundler = watchify(bundler);
  }

  function rebundle() {
    bundler.bundle()
      .on('error', (err) => {
        gutil.beep();
        gutil.log(gutil.colors.red(`Error (browserify):\n${err.toString()}`));
        if (!isWatching) {
          throw err;
        }
      })
      .pipe(source(outputFile))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(uglify())
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest(outputPath));
  }

  if (isWatching) {
    bundler.on('update', () => {
      gutil.log(`-> Rebundling ${entryPath}`);
      rebundle();
    });
  }

  rebundle();
  return bundler;
}

gulp.task('js:data-capture', () =>
  browserifyBundle(
    path.join(dirs.src.scripts, paths.dataCaptureEntry),
    dirs.dest.scripts.dataCapture,
    paths.dataCaptureOutfile
  )
);

gulp.task('lint', () => {
  const opts = {};
  if (isInDocker) {
    opts.rules = {
      // Until https://github.com/benmosher/eslint-plugin-import/issues/142
      // is fixed, we need to disable the following rule for Docker support.
      'import/no-unresolved': 0,
    };
  }

  return gulp.src(path.join(dirs.src.scripts, paths.js))
    .pipe(eslint(opts))
    .pipe(eslint.format());
});

gulp.task('js:tests', () =>
  browserifyBundle(
    path.join(dirs.src.scripts, paths.testEntry),
    dirs.dest.scripts.tests,
    paths.testOutfile
  )
);

// set up a SIGTERM handler for quick graceful exit from docker
process.on('SIGTERM', () => {
  process.exit(1);
});
