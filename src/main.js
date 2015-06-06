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
          team.winCount = 0;
          team.lostCount = 0;
          return team;
        });

        data.teamLookup = data.teams.reduce(function(prev, current){
          prev[current.name] = current;
          return prev;
        }, {});

        data.pairLookup = data.matches.reduce(function(prev, match){
          match.pair = [match.winners, match.runnersUp].sort(function(a,b){ return a.localeCompare(b); }).join('/');
          prev[match.pair] = prev[match.pair] ? prev[match.pair]+1 : 1;
          return prev;
        }, {});

        data.matches = data.matches.map(function(match){
          match.pairCount = data.pairLookup[match.pair];
          match.winners = data.teamLookup[match.winners];
          match.winners.winCount++;
          match.runnersUp = data.teamLookup[match.runnersUp];
          match.runnersUp.lostCount++;
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
      sortBy: 'time',
      minRadius: 5,
      maxRadius: 26
    }, [], function(skeleton){

      var options = skeleton.options();
      // var color = d3.scale.category10();
      var color = d3.scale.ordinal()
        .range([
          '#779ecb', // blue
          '#C2573C', // red
          '#836953', // brown
          '#7DC68E', // green
          '#aec6cf', // light blue
          '#cb99c9', // magenta
          '#EEAC68', // orange
          '#687C58', // light purple
          '#966FD6', // purple
          '#417C4B'  // dark green
        ]);

      skeleton.on('data', function(data){
        data.teams.sort(function(a,b){
          if(a.nation.name!==b.nation.name){
            return a.nation.name.localeCompare(b.nation.name);
          }
          return a.name.localeCompare(b.name);
        })
        .forEach(function(team, i){
          team.index = i;
        });

        visualize();
      });

      skeleton.on('options', visualize);

      function visualize(){
        var data = skeleton.data();

        var nest, i;
        if(options.sortBy==='time'){
          data.matches.forEach(function(match){
            match.index = match.year - 1956;
          });
        }
        else if(options.sortBy==='win'){
          nest = d3.nest()
            .key(function(d){return d.winners.name;})
            .sortValues(function(a,b){ return d3.ascending(a.year, b.year); })
            .entries(data.matches);

          i=0;
          nest.sort(function(a, b){
              if(a.values[0].winners.winCount!==b.values[0].winners.winCount){
                return b.values[0].winners.winCount - a.values[0].winners.winCount;
              }
              if(a.values[0].winners.nation.name!==b.values[0].winners.nation.name){
                return a.values[0].winners.nation.name.localeCompare(b.values[0].winners.nation.name);
              }
              return a.key.localeCompare(b.key);
            })
            .forEach(function(group){
              group.values.forEach(function(match){
                match.index = i;
                i++;
              });
            });
        }
        else if(options.sortBy==='lost'){
          nest = d3.nest()
            .key(function(d){return d.runnersUp.name;})
            .sortValues(function(a,b){ return d3.ascending(a.year, b.year); })
            .entries(data.matches);

          i=0;
          nest.sort(function(a, b){
              if(a.values[0].runnersUp.lostCount!==b.values[0].runnersUp.lostCount){
                return b.values[0].runnersUp.lostCount - a.values[0].runnersUp.lostCount;
              }
              if(a.values[0].runnersUp.nation.name!==b.values[0].runnersUp.nation.name){
                return a.values[0].runnersUp.nation.name.localeCompare(b.values[0].runnersUp.nation.name);
              }
              return a.key.localeCompare(b.key);
            })
            .forEach(function(group){
              group.values.forEach(function(match){
                match.index = i;
                i++;
              });
            });
        }
        else if(options.sortBy==='pair'){
          nest = d3.nest()
            .key(function(d){return d.pair;})
            .sortValues(function(a,b){
              if(a.winners.name!==b.winners.name){
                return a.winners.name.localeCompare(b.winners.name);
              }
              return d3.ascending(a.year, b.year);
            })
            .entries(data.matches);

          i=0;
          nest.sort(function(a, b){
              var aCount = data.pairLookup[a.key];
              var bCount = data.pairLookup[b.key];
              if(aCount!==bCount){
                return bCount - aCount;
              }
              return a.key.localeCompare(b.key);
            })
            .forEach(function(group){
              group.values.forEach(function(match){
                match.index = i;
                i++;
              });
            });

        }

        data.matches
          .forEach(function(match){
            match.x = xPos(match.index);
          });

        skeleton.height(data.teams.length*20 + options.margin.top + options.margin.bottom);
        skeleton.width(yearPos({year: 2015}) + 10 + options.margin.left + options.margin.right);

        var selection = skeleton.getRootG().selectAll('g.team')
          .data(data.teams, function(d){return d.name;});

        var sEnter = selection.enter().append('g')
          .classed('team', true)
          .attr('transform', function(d, i){return 'translate('+(150)+','+(i* 20)+')';});

        sEnter.append('circle')
          .style('fill', teamColor)
          .attr('r', options.minRadius);

        sEnter.append('text')
          .attr('x', -10)
          .attr('y', 4)
          .style('text-anchor', 'end')
          .text(function(d){return d.name;});

        sEnter.append('line')
          .classed('team-line', true)
          .attr('x1', 6)
          .attr('x2', skeleton.getInnerWidth()-150);

        var edges = skeleton.getRootG().selectAll('g.match')
          .data(data.matches, function(d){return d.year;});

        var edgesEnter = edges.enter().append('g')
          .classed('match', true)
          .attr('transform', function(d){return 'translate('+(d.x)+','+(0)+')';});

        edgesEnter.append('line')
          .style('stroke-width', 2)
          .style('stroke', function(d){return color(d.winners.nation.name);})
          .attr('y1', winnerPos)
          .attr('y2', runnersUpPos);

        edgesEnter.append('circle')
          .style('fill', function(d){return color(d.winners.nation.name);})
          .attr('cy', winnerPos)
          .attr('r', 4);

        edgesEnter.append('circle')
          .classed('loser-circle', true)
          .attr('cy', runnersUpPos)
          .attr('r', 4);

        edgesEnter.append('g')
            .attr('transform', 'rotate(-90)')
          .append('text')
            .classed('score-label', true)
            .attr('x', function(d){return 8-Math.min(winnerPos(d), runnersUpPos(d));})
            .attr('y', 3)
            .text(function(d){
              return d.special ? d.score + '  / '+ d.special : d.score; //d.year;
            });

        edgesEnter.append('g')
            .attr('transform', 'rotate(-90)')
          .append('text')
            .classed('year-label', true)
            .attr('x', function(d){return -8-Math.max(winnerPos(d), runnersUpPos(d));})
            .attr('y', 3)
            .text(function(d){return d.year;});

        edges.transition()
          .delay(function(d,i){return i*10;})
          .attr('transform', function(d){return 'translate('+(d.x)+','+(0)+')';});
      }

      function yearPos(d){
        return xPos(d.year-1956);
      }

      function xPos(index){
        return 150 + (index+1) * 13 + 20;
      }

      function winnerPos(d){
        return d.winners.index * 20;
      }

      function runnersUpPos(d){
        return d.runnersUp.index * 20;
      }

      function teamColor(team){
        return color(team.nation.name);
      }

    });
  })
  .controller('mainCtrl', function($scope, dataService, Vis){
    var chart = new Vis('#chart');

    $scope.options = {
      sortBy: 'time'
    };

    $scope.sortBy = function(mode){
      $scope.options.sortBy = mode;
      chart.options({
        sortBy: mode
      });
    };

    dataService.loadData().then(function(data){
      chart.data(data);
    });
  });