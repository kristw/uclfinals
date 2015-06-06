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
      margin: {top: 30, left: 40, right: 40, bottom: 30},
      initialWidth: 1100,
      initialHeight: 600,
      minRadius: 5,
      maxRadius: 26
    }, [], function(skeleton){

      var options = skeleton.options();
      // var color = d3.scale.category10();
      var color = d3.scale.ordinal()
        .range(['#779ecb', '#c23b22', '#836953', '#77dd77', '#aec6cf', '#cb99c9', '#ffb347', '#b39eb5', '#966FD6', '#f49ac2']);

      skeleton.on('data', visualize);

      function visualize(){
        var data = skeleton.data();

        data.teams.sort(function(a,b){
          var score = a.nation.name.localeCompare(b.nation.name);
          return score!==0 ? score : a.name.localeCompare(b.name);
        })
        .forEach(function(team, i){
          team.index = i;
        });

        skeleton.height(data.teams.length*20 + options.margin.top+options.margin.bottom);

        var selection = skeleton.getRootG().selectAll('g.team')
          .data(data.teams, function(d){return d.name;});

        var sEnter = selection.enter().append('g')
          .classed('team', true)
          .attr('transform', function(d, i){return 'translate('+(150)+','+(i* 20)+')';});

        sEnter.append('circle')
          .style('fill', function(d){return color(d.nation.name);})
          .attr('r', options.minRadius);

        sEnter.append('text')
          .attr('x', -10)
          .attr('y', 4)
          .style('text-anchor', 'end')
          .text(function(d){return d.name;});

        sEnter.append('line')
          .style('stroke-width', 1)
          .style('stroke', '#777')
          .style('stroke-dasharray', '2,2')
          .attr('x1', 4)
          .attr('x2', skeleton.getInnerWidth()-150);

        var edges = skeleton.getRootG().selectAll('g.match')
          .data(data.matches, function(d){return d.year;});

        var edgesEnter = edges.enter().append('g')
          .classed('match', true)
          .attr('transform', function(d){return 'translate('+(yearPos(d))+','+(0)+')';});

        edgesEnter.append('line')
          .style('stroke-width', 2)
          // .style('stroke', '#000')
          .style('stroke', function(d){return color(d.winners.nation.name);})
          .attr('y1', winnerPos)
          .attr('y2', runnersUpPos);

        edgesEnter.append('circle')
          .style('fill', function(d){return color(d.winners.nation.name);})
          .attr('cy', winnerPos)
          .attr('r', 4);

        edgesEnter.append('circle')
          .attr('cy', runnersUpPos)
          .attr('r', 4)
          .style('fill', '#fff')
          .style('stroke', '#222')
          .style('stroke-width', 1);

        edgesEnter.append('g')
          .attr('transform', 'rotate(-90)')
          .append('text')
          .attr('x', function(d){return 8-Math.min(winnerPos(d), runnersUpPos(d));})
          .attr('y', 3)
          .text(function(d){
            return d.special ? d.score + '  / '+ d.special : d.score; //d.year;
          });

        edgesEnter.append('g')
          .attr('transform', 'rotate(-90)')
          .append('text')
          .attr('x', function(d){return -8-Math.max(winnerPos(d), runnersUpPos(d));})
          .attr('y', 3)
          .style('text-anchor', 'end')
          .text(function(d){return d.year;});
      }

      function yearPos(d){
        return 150 + (d.year-1955) * 14 + 20;
      }

      function winnerPos(d){
        return d.winners.index * 20;
      }

      function runnersUpPos(d){
        return d.runnersUp.index * 20;
      }

    });
  })
  .controller('mainCtrl', function($scope, dataService, Vis){
    var chart = new Vis('#chart');



    dataService.loadData().then(function(data){
      chart.data(data);
    });
  });