(function(){

  const toggleSwitch = document.querySelector('#toggle-switch');
  const context = document.querySelector('#chart-canvas').getContext("2d");

  const config = {
    type: 'bar',
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    },
  };

  function createWeeklyChart (chart, weekSales) {
    chart.data = getDataConfiguration(getWeeklyChartData(weekSales));
    chart.update();
  };

  function createYearlyChart (chart, yearSales) {
    chart.data = getDataConfiguration(getYearlyChartData(yearSales));
    chart.update();
  };

  function getWeeklyChartData(weekSales){
    const labels = [];
    const data = Object.values(weekSales).map((sale, index) => {
      if (index === 0) labels.push('today');
      if (index === 1) labels.push('yesterday');
      if (index > 1) labels.push(`day ${index + 1}`);
      return  sale.total;
    });
    return { data, labels };
  }

  function getYearlyChartData(yearSales){
    const labels = [];
    const data = Object.values(yearSales).map((sale, index) => {
      if (index === 0) labels.push('this month');
      if (index === 1) labels.push('last month');
      if (index > 1) labels.push(`month ${index + 1}`);
      return  sale.total;
    });
    return { data, labels };
  }

  /**
   * 
   * @param {{ labels: Array, data: Array }} param0 
   */
  function getDataConfiguration ({ labels, data }) {
    return {
      labels: labels,
      datasets: [{
        label: 'Revenues',
        data: data,
        borderWidth: 1
      }]
    };
  }

  /**
   * 
   * @param {Array} bestsellers 
   */
  function generateBestsellersRows(bestsellers) {
    const topSellers = bestsellers.sort((sellerA, sellerB) => sellerB.units - sellerA.units).slice(0, 3);
    const tableRows = document.querySelector('#table-rows');
    
    for(const [_, seller] of topSellers.entries()){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${seller?.product?.name}</td>
        <td></td>
        <td>${seller?.units}</td>
        <td>${seller?.revenue}</td>
      `;
      tableRows.appendChild(tr);
    }
  }

  /**
   * 
   * @param {Array} weekSales 
   * @param {Array} yearSales 
   */


  /**
   * @param {{ orders: number; total: number }} sale
   */
  const getSummaryString = ({ total, orders }) => `${formatHelper.convertToCompactNumber(total)} / ${orders} orders`;

  function updateOrderSummaryCards(weekSales, yearSales) {

    const lastWeeksSummary = weekSales.reduce((prev, current) => {
      prev.orders += current.orders;
      prev.total += current.total;
      return prev;
    }, { orders: 0, total: 0 });

    //setting today's summary
    document.querySelector('#todays-summary').textContent = getSummaryString(weekSales[0]);
    //setting last week's summary
    document.querySelector('#last-weeks-summary').textContent = getSummaryString(lastWeeksSummary);
    //setting last month's summary
    document.querySelector('#last-months-summary').textContent = getSummaryString(yearSales[1]);

  }

  document.addEventListener('DOMContentLoaded', async () => {
    //fetch dashboard data
    const { sales_over_time_week, sales_over_time_year, bestsellers } = await dataservice.getDashboardData();
    
    // initialize chart 
    const chart = new Chart(context, config);
    
    //update summary cards
    updateOrderSummaryCards(Object.values(sales_over_time_week), Object.values(sales_over_time_year));

    toggleSwitch.addEventListener("change", (e) => {
      const revenuePeriod = document.querySelector('#revenue-period');
      const isChecked = e.target.checked;
      if (isChecked) {
        revenuePeriod.textContent = '12 months';
        return createYearlyChart(chart, sales_over_time_year);
      }
      revenuePeriod.textContent = '7 days';
      createWeeklyChart(chart, sales_over_time_week);
    });

    // render weekly view on initial render
    createWeeklyChart(chart, sales_over_time_week);

    // render top sellers
    generateBestsellersRows(bestsellers);


    //perform cleanup
    return () => chart.destroy();
  });
})();