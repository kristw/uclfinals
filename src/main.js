angular.module('app', ['d3.promise'])
  .factory('dataService', function($q, d3Promise){
    var module = {};

    module.loadData = function(){
      return $q.all({
        matches: d3Promise.tsv('data/matches.tsv'),
        teams: d3Promise.tsv('data/teams.tsv'),
        nations: d3Promise.tsv('data/nations.tsv')
      }).then(function(data){
        data.nationLookup = data.nations.reduce(function(prev, current){
          current.lat = +current.lat;
          current.lon = +current.lon;
          prev[current.name] = current;
          return prev;
        }, {});

        data.teams = data.teams.map(function(team){
          team.nation = data.nationLookup[team.nation];
          return team;
        });

        data.teamLookup = data.teams.reduce(function(prev, current){
          prev[current.name] = current;
          return prev;
        }, {});

        data.matches = data.matches.map(function(match){
          match.pair = [match.winners, match.runnersUp].sort(function(a,b){ return a.localeCompare(b); }).join('/');
          match.winners = data.teamLookup[match.winners];
          match.runnersUp = data.teamLookup[match.runnersUp];
          match.year = +match.year;
          match.attendance = +match.attendance;
          return match;
        });

        return data;
      });
    };

    return module;
  })
  .factory('Vis', function(){
    return d3Kit.factory.createChart({
      margin: {top: 10, left: 10, right: 10, bottom: 10},
      initialWidth: 800,
      initialHeight: 600,
      minRadius: 5,
      maxRadius: 26
    }, [], function(skeleton){

      var options = skeleton.options();
      var color = d3.scale.category10();

      var projection = d3.geo.mercator()
        .scale(1000)
        // Customize the projection to make the center of Europe become the center of the map
        .rotate([-10.3167, -48.3839])
        .translate([skeleton.getInnerWidth() / 2, skeleton.getInnerHeight() / 2]);

      var path = d3.geo.path()
        .projection(projection);

      var world = Physics();
      world.add([
        Physics.behavior('edge-collision-detection', {
          aabb: Physics.aabb(0,0, skeleton.getInnerWidth(), skeleton.getInnerHeight()),
          restitution: 0.99,
          cof: 0.99
        }),
        Physics.behavior('body-collision-detection'),
        Physics.behavior('body-impulse-response'),
        Physics.behavior('sweep-prune')
      ]);
      world.on('step', function(){
        visualize();
      });

      skeleton.on('data', function(data){
        console.log('data', data);

        data.teams.map(function(team){
          var xy = projection([team.nation.lon, team.nation.lat]);
          console.log('xy', xy);

          var body = Physics.body('circle', {
            x: xy[0] + Math.random()*10,
            y: xy[1] + Math.random()*10,
            radius: options.maxRadius
          });
          team.body = body;
          body.team = team;

          // var attraction = Physics.behavior('attractor', {
          //   strength: 2,
          //   max: 200
          // })
          //   .position(xy)
          //   .applyTo([body]);

          world.add(body);
          // world.add(attraction);
        });

        // world.add(bodies);
        // world.add(attractions);

        Physics.util.ticker.on(function(time, dt){
          world.step(time);
        });
        Physics.util.ticker.start();
      });

      function visualize(){
        var data = skeleton.data();

        var selection = skeleton.getRootG().selectAll('g.team')
          .data(data.teams, function(d){return d.name;});

        var sEnter = selection.enter().append('g')
          .classed('team', true)
          .attr('transform', function(d){return 'translate('+(d.body.state.pos.x)+','+(d.body.state.pos.y)+')';});

        sEnter.append('circle')
          .style('fill', function(d){return color(d.nation.name);})
          .attr('r', options.minRadius);

        // sEnter.append('text')
        //   .attr('x', 10)
        //   .attr('y', 20)
        //   .text(function(d){return d.name;});

        selection
          .attr('transform', function(d){return 'translate('+(d.body.state.pos.x)+','+(d.body.state.pos.y)+')';});

        var edges = skeleton.getRootG().selectAll('line')
          .data(data.matches, function(d){return d.year;})

        edges.enter().append('line')
          .style('stroke-width', 1)
          .style('stroke', '#000')
          .attr('x1', function(d){return d.winners.body.state.pos.x;})
          .attr('y1', function(d){return d.winners.body.state.pos.y;})
          .attr('x2', function(d){return d.runnersUp.body.state.pos.x;})
          .attr('y2', function(d){return d.runnersUp.body.state.pos.y;})

        edges
          .attr('x1', function(d){return d.winners.body.state.pos.x;})
          .attr('y1', function(d){return d.winners.body.state.pos.y;})
          .attr('x2', function(d){return d.runnersUp.body.state.pos.x;})
          .attr('y2', function(d){return d.runnersUp.body.state.pos.y;})
      }

    });
  })
  .controller('mainCtrl', function($scope, dataService, Vis){
    var chart = new Vis('#chart');



    dataService.loadData().then(function(data){
      chart.data(data);
    });
  });